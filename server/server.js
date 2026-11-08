const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();
const { PROJECT_STATUSES, isObjectIdString, validateStory } = require("./storyValidation");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 3000);
const DATABASE_NAME = process.env.MONGO_DB_NAME || "pa2"; // Preserve PA3's database.

let client;
let usersCollection;
let projectCollection;
let projectMembershipCollection;
let userStoriesCollection;

const objectId = (id) => new ObjectId(id);
const safeUser = (user) => user ? ({
  _id: user._id,
  f_name: user.f_name,
  l_name: user.l_name,
  username: user.username
}) : null;

function sendServerError(res, label, error) {
  console.error(label, error);
  return res.status(500).json({ message: label });
}

async function getProject(projectId, res) {
  if (!isObjectIdString(projectId)) {
    res.status(400).json({ message: "Invalid project ID." });
    return null;
  }
  const project = await projectCollection.findOne({ _id: objectId(projectId) });
  if (!project) {
    res.status(404).json({ message: "Project does not exist." });
    return null;
  }
  return project;
}

async function verifyAssignee(project, assignedUserId) {
  if (assignedUserId === null) return null;
  const userId = objectId(assignedUserId);
  const user = await usersCollection.findOne({ _id: userId });
  if (!user) return "Assigned user does not exist.";
  const membership = await projectMembershipCollection.findOne({
    project_id: project._id,
    user_id: userId
  });
  if (!membership) return "Assigned user must be a current member of this project.";
  return null;
}

async function withAssignees(stories) {
  const ids = [...new Set(stories
    .filter((story) => story.assigned_user_id)
    .map((story) => story.assigned_user_id.toString()))].map(objectId);
  const assignees = ids.length ? await usersCollection.find(
    { _id: { $in: ids } }, { projection: { password: 0 } }
  ).toArray() : [];
  const byId = new Map(assignees.map((user) => [user._id.toString(), safeUser(user)]));
  return stories.map((story) => ({
    ...story,
    assigned_user: story.assigned_user_id
      ? (byId.get(story.assigned_user_id.toString()) || null)
      : null
  }));
}

app.get("/", (_req, res) => res.send("PA4 User Stories and Project Backlog server"));

// Existing PA2 functionality: users, signup and login.
app.get("/users", async (_req, res) => {
  try {
    const users = await usersCollection.find({}, { projection: { password: 0 } })
      .sort({ username: 1 }).toArray();
    return res.json(users);
  } catch (error) {
    return sendServerError(res, "Could not retrieve users.", error);
  }
});

app.post("/signup", async (req, res) => {
  try {
    const { f_name, l_name, username, password } = req.body || {};
    if ([f_name, l_name, username, password].some(
      (item) => typeof item !== "string" || !item.trim()
    )) {
      return res.status(400).json({ message: "All signup fields are required." });
    }
    const cleanUsername = username.trim();
    if (await usersCollection.findOne({ username: cleanUsername })) {
      return res.status(409).json({ message: "Username already exists." });
    }
    // Keep PA2's stored-password behavior unchanged to preserve compatibility.
    await usersCollection.insertOne({
      f_name: f_name.trim(), l_name: l_name.trim(),
      username: cleanUsername, password
    });
    return res.status(201).json({ message: "User created successfully!" });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Username already exists." });
    }
    return sendServerError(res, "Could not create user.", error);
  }
});

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required." });
    }
    const user = await usersCollection.findOne({ username });
    if (!user) return res.status(404).json({ message: "Username does not exist." });
    if (user.password !== password) {
      return res.status(401).json({ message: "Incorrect password." });
    }
    return res.json({ message: "Login successful!" });
  } catch (error) {
    return sendServerError(res, "Could not log in.", error);
  }
});

// Existing PA3 functionality: project creation and listing.
app.post("/projects", async (req, res) => {
  let createdProjectId;
  try {
    const { name, description, status, project_lead_id } = req.body || {};
    if (typeof name !== "string" || !name.trim() ||
      typeof description !== "string" || !description.trim() ||
      !PROJECT_STATUSES.includes(status) || !isObjectIdString(project_lead_id)) {
      return res.status(400).json({ message: "Provide project name, description, a valid status, and Project Lead." });
    }
    const lead = await usersCollection.findOne({ _id: objectId(project_lead_id) });
    if (!lead) return res.status(404).json({ message: "Selected Project Lead does not exist." });

    const newProject = {
      name: name.trim(), description: description.trim(), status,
      project_lead_id: lead._id
    };
    const result = await projectCollection.insertOne(newProject);
    createdProjectId = result.insertedId;
    await projectMembershipCollection.insertOne({
      project_id: result.insertedId, user_id: lead._id
    });
    return res.status(201).json({
      message: "Project created successfully!",
      project: { _id: result.insertedId, ...newProject }
    });
  } catch (error) {
    if (createdProjectId) {
      try {
        await projectMembershipCollection.deleteMany({ project_id: createdProjectId });
        await projectCollection.deleteOne({ _id: createdProjectId });
      } catch (cleanupError) {
        console.error("Project rollback failed:", cleanupError);
      }
    }
    return sendServerError(res, "Could not create project.", error);
  }
});

app.get("/projects", async (_req, res) => {
  try {
    const projects = await projectCollection.find({}).toArray();
    const leads = await usersCollection.find({
      _id: { $in: projects.map((project) => project.project_lead_id) }
    }, { projection: { password: 0 } }).toArray();
    const leadMap = new Map(leads.map((lead) => [lead._id.toString(), safeUser(lead)]));
    return res.json(projects.map((project) => ({
      ...project,
      project_lead: leadMap.get(project.project_lead_id.toString()) || null
    })));
  } catch (error) {
    return sendServerError(res, "Could not retrieve projects.", error);
  }
});

// Existing PA3 membership management, with PA4's member-removal safeguard.
app.get("/projects/:projectId/members", async (req, res) => {
  try {
    const project = await getProject(req.params.projectId, res);
    if (!project) return;
    const memberships = await projectMembershipCollection.find({ project_id: project._id }).toArray();
    const users = await usersCollection.find({
      _id: { $in: memberships.map((entry) => entry.user_id) }
    }, { projection: { password: 0 } }).sort({ username: 1 }).toArray();
    return res.json(users.map((user) => ({
      ...safeUser(user),
      isProjectLead: user._id.equals(project.project_lead_id)
    })));
  } catch (error) {
    return sendServerError(res, "Could not retrieve project members.", error);
  }
});

app.post("/projects/:projectId/members", async (req, res) => {
  try {
    const project = await getProject(req.params.projectId, res);
    if (!project) return;
    const { user_id } = req.body || {};
    if (!isObjectIdString(user_id)) {
      return res.status(400).json({ message: "Invalid user ID." });
    }
    const user = await usersCollection.findOne({ _id: objectId(user_id) });
    if (!user) return res.status(404).json({ message: "User does not exist." });
    const selector = { project_id: project._id, user_id: user._id };
    if (await projectMembershipCollection.findOne(selector)) {
      return res.status(409).json({ message: "This user is already a project member." });
    }
    await projectMembershipCollection.insertOne(selector);
    return res.status(201).json({ message: "Member added successfully." });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "This user is already a project member." });
    }
    return sendServerError(res, "Could not add project member.", error);
  }
});

app.delete("/projects/:projectId/members/:userId", async (req, res) => {
  try {
    const project = await getProject(req.params.projectId, res);
    if (!project) return;
    const { userId } = req.params;
    if (!isObjectIdString(userId)) {
      return res.status(400).json({ message: "Invalid user ID." });
    }
    const memberId = objectId(userId);
    if (memberId.equals(project.project_lead_id)) {
      return res.status(400).json({ message: "The Project Lead cannot be removed." });
    }
    const user = await usersCollection.findOne({ _id: memberId });
    if (!user) return res.status(404).json({ message: "User does not exist." });

    // All assigned stories count, including Done stories. Only this project's
    // assignments matter; assignments in other projects do not block removal.
    const assignedStory = await userStoriesCollection.findOne({
      project_id: project._id, assigned_user_id: memberId
    });
    if (assignedStory) {
      return res.status(409).json({
        message: "This member has assigned stories in this project (including Done stories). Reassign, unassign, or delete those stories before removing the member."
      });
    }
    const result = await projectMembershipCollection.deleteOne({
      project_id: project._id, user_id: memberId
    });
    if (!result.deletedCount) {
      return res.status(404).json({ message: "This user is not a member of the project." });
    }
    return res.json({ message: "Member removed successfully." });
  } catch (error) {
    return sendServerError(res, "Could not remove project member.", error);
  }
});

// PA4: View the selected project's COMPLETE backlog, including Done stories.
app.get("/projects/:projectId/stories", async (req, res) => {
  try {
    const project = await getProject(req.params.projectId, res);
    if (!project) return;
    const stories = await userStoriesCollection.find({ project_id: project._id })
      .sort({ _id: -1 }).toArray();
    return res.json(await withAssignees(stories));
  } catch (error) {
    return sendServerError(res, "Could not retrieve project backlog.", error);
  }
});

// PA4: Create a story. Its status is assigned server-side, always To Do.
app.post("/projects/:projectId/stories", async (req, res) => {
  try {
    const project = await getProject(req.params.projectId, res);
    if (!project) return;
    const checked = validateStory(req.body, { projectId: req.params.projectId });
    if (checked.error) return res.status(400).json({ message: checked.error });
    const assignmentError = await verifyAssignee(project, checked.value.assigned_user_id);
    if (assignmentError) return res.status(400).json({ message: assignmentError });

    const story = {
      project_id: project._id,
      ...checked.value,
      assigned_user_id: checked.value.assigned_user_id
        ? objectId(checked.value.assigned_user_id) : null
    };
    const result = await userStoriesCollection.insertOne(story);
    return res.status(201).json({
      message: "User story created successfully.",
      story: { _id: result.insertedId, ...story }
    });
  } catch (error) {
    return sendServerError(res, "Could not create user story.", error);
  }
});

// PA4: Edit the existing document, without changing its project_id.
app.put("/projects/:projectId/stories/:storyId", async (req, res) => {
  try {
    const project = await getProject(req.params.projectId, res);
    if (!project) return;
    if (!isObjectIdString(req.params.storyId)) {
      return res.status(400).json({ message: "Invalid story ID." });
    }
    const selector = { _id: objectId(req.params.storyId), project_id: project._id };
    const existing = await userStoriesCollection.findOne(selector);
    if (!existing) return res.status(404).json({ message: "Story not found in this project." });

    const checked = validateStory(req.body, { isEdit: true, projectId: req.params.projectId });
    if (checked.error) return res.status(400).json({ message: checked.error });
    const assignmentError = await verifyAssignee(project, checked.value.assigned_user_id);
    if (assignmentError) return res.status(400).json({ message: assignmentError });

    const changes = {
      ...checked.value,
      assigned_user_id: checked.value.assigned_user_id
        ? objectId(checked.value.assigned_user_id) : null
    };
    await userStoriesCollection.updateOne(selector, { $set: changes });
    return res.json({ message: "User story updated successfully.", story: { ...existing, ...changes } });
  } catch (error) {
    return sendServerError(res, "Could not update user story.", error);
  }
});

app.delete("/projects/:projectId/stories/:storyId", async (req, res) => {
  try {
    const project = await getProject(req.params.projectId, res);
    if (!project) return;
    if (!isObjectIdString(req.params.storyId)) {
      return res.status(400).json({ message: "Invalid story ID." });
    }
    const result = await userStoriesCollection.deleteOne({
      _id: objectId(req.params.storyId), project_id: project._id
    });
    if (!result.deletedCount) {
      return res.status(404).json({ message: "Story not found in this project." });
    }
    return res.json({ message: "User story deleted successfully." });
  } catch (error) {
    return sendServerError(res, "Could not delete user story.", error);
  }
});

async function startServer() {
  if (!process.env.MONGO_URI) {
    console.error("Missing MONGO_URI. Copy server/.env.example to server/.env and configure MongoDB.");
    process.exit(1);
  }
  try {
    client = new MongoClient(process.env.MONGO_URI);
    await client.connect();
    const database = client.db(DATABASE_NAME);
    usersCollection = database.collection("users");
    projectCollection = database.collection("Projects");
    projectMembershipCollection = database.collection("ProjectMemberships");
    userStoriesCollection = database.collection("UserStories");
    // Speed up project-scoped backlog and member removal lookups.
    await userStoriesCollection.createIndex({ project_id: 1, assigned_user_id: 1 });
    console.log(`Connected to MongoDB database: ${DATABASE_NAME}`);
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    process.exit(1);
  }
}

if (require.main === module) startServer();
module.exports = { app, startServer };
