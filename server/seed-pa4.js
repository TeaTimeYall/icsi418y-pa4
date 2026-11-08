// Run with: npm run seed
// Non-destructive and safe to rerun: only inserts demo documents if missing.
const { MongoClient } = require("mongodb");
require("dotenv").config();

const URI = process.env.MONGO_URI;
const DATABASE_NAME = process.env.MONGO_DB_NAME || "pa2";

async function main() {
  if (!URI) throw new Error("MONGO_URI is missing. Configure server/.env first.");
  const client = new MongoClient(URI);
  try {
    await client.connect();
    const db = client.db(DATABASE_NAME);
    const users = db.collection("users");
    const projects = db.collection("Projects");
    const memberships = db.collection("ProjectMemberships");
    const stories = db.collection("UserStories");

    // PA4 requires three users, two projects, different project memberships,
    // and at least five stories covering all priorities/statuses/assignment types.
    const demoUsers = [
      { f_name: "Alex", l_name: "Rivera", username: "pa4_demo_alex", password: "DemoPass123!" },
      { f_name: "Blair", l_name: "Chen", username: "pa4_demo_blair", password: "DemoPass123!" },
      { f_name: "Casey", l_name: "Morgan", username: "pa4_demo_casey", password: "DemoPass123!" }
    ];
    const ids = {};
    for (const user of demoUsers) {
      await users.updateOne({ username: user.username }, { $setOnInsert: user }, { upsert: true });
      ids[user.username] = (await users.findOne({ username: user.username }))._id;
    }

    const demoProjects = [
      { name: "Campus Events Planner (PA4 Demo)", description: "Plan campus events and registrations.", status: "Active", project_lead_id: ids.pa4_demo_alex },
      { name: "Study Group Organizer (PA4 Demo)", description: "Coordinate student study groups.", status: "Planning", project_lead_id: ids.pa4_demo_casey }
    ];
    const projectIds = [];
    for (const project of demoProjects) {
      await projects.updateOne({ name: project.name }, { $setOnInsert: project }, { upsert: true });
      projectIds.push((await projects.findOne({ name: project.name }))._id);
    }
    const [eventsId, studyId] = projectIds;
    // Blair belongs to Events ONLY, and cannot be assigned a Study story.
    const membershipPairs = [
      [eventsId, ids.pa4_demo_alex],
      [eventsId, ids.pa4_demo_blair],
      [studyId, ids.pa4_demo_casey],
      [studyId, ids.pa4_demo_alex]
    ];
    for (const [project_id, user_id] of membershipPairs) {
      await memberships.updateOne({ project_id, user_id }, { $setOnInsert: { project_id, user_id } }, { upsert: true });
    }

    const demoStories = [
      { project_id: eventsId, title: "Browse upcoming campus events", description: "As a student, I want to browse upcoming campus events, so that I can decide which to attend.", priority: "High", status: "To Do", assigned_user_id: ids.pa4_demo_alex },
      { project_id: eventsId, title: "Save events to my calendar", description: "As a student, I want to save an event to my calendar, so that I can remember its date and time.", priority: "Medium", status: "In Progress", assigned_user_id: ids.pa4_demo_blair },
      { project_id: eventsId, title: "View event location details", description: "As a student, I want to view an event location, so that I can find the correct building.", priority: "Low", status: "Done", assigned_user_id: null },
      { project_id: studyId, title: "Create a study group", description: "As a student, I want to create a study group, so that classmates can prepare for exams together.", priority: "High", status: "To Do", assigned_user_id: ids.pa4_demo_casey },
      { project_id: studyId, title: "Join an existing study group", description: "As a student, I want to join a study group, so that I can study with classmates.", priority: "Low", status: "Done", assigned_user_id: ids.pa4_demo_alex },
      { project_id: studyId, title: "Announce meeting changes", description: "As a group leader, I want to announce meeting changes, so that members know the updated schedule.", priority: "Medium", status: "In Progress", assigned_user_id: null }
    ];
    for (const story of demoStories) {
      await stories.updateOne(
        { project_id: story.project_id, title: story.title },
        { $setOnInsert: story },
        { upsert: true }
      );
    }

    console.log(`Demo data ready in ${DATABASE_NAME}: 3 users, 2 projects, 6 stories.`);
    console.log("Demo login usernames: pa4_demo_alex, pa4_demo_blair, pa4_demo_casey");
    console.log("Demo password (local coursework use only): DemoPass123!");
    console.log("Blair can be assigned in Campus Events, but not Study Group Organizer.");
  } finally {
    await client.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
