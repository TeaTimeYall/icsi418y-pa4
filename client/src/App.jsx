
import { useEffect, useRef, useState } from "react";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:3000";
const EMPTY_STORY = {
  title: "",
  description: "",
  priority: "Medium",
  status: "To Do",
  assigned_user_id: ""
};

async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers }
    });
  } catch {
    throw new Error("Could not connect to the backend. Check that the server is running.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status}).`);
  return data;
}

function displayName(user) {
  if (!user) return "Unassigned";
  const name = [user.f_name, user.l_name].filter(Boolean).join(" ").trim();
  return name ? `${name} (@${user.username})` : `@${user.username}`;
}

function App() {
  // PA2: Existing signup and login forms.
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [signupMessage, setSignupMessage] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginMessage, setLoginMessage] = useState("");

  // PA3: Projects and memberships.
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectStatus, setProjectStatus] = useState("Planning");
  const [projectLeadId, setProjectLeadId] = useState("");
  const [projectMessage, setProjectMessage] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const selectedProjectRef = useRef("");
  const [members, setMembers] = useState([]);
  const [memberUserId, setMemberUserId] = useState("");
  const [membershipMessage, setMembershipMessage] = useState("");

  // PA4: User stories for the currently selected project only.
  const [stories, setStories] = useState([]);
  const [storyForm, setStoryForm] = useState(EMPTY_STORY);
  const [editingStoryId, setEditingStoryId] = useState(null);
  const [openStoryId, setOpenStoryId] = useState(null);
  const [storyMessage, setStoryMessage] = useState("");
  const [backlogMessage, setBacklogMessage] = useState("");
  const [isLoadingBacklog, setIsLoadingBacklog] = useState(false);
  const [isSavingStory, setIsSavingStory] = useState(false);

  const selectedProject = projects.find((project) => project._id === selectedProjectId);

  useEffect(() => {
    let active = true;
    Promise.all([api("/users"), api("/projects")])
      .then(([loadedUsers, loadedProjects]) => {
        if (!active) return;
        setUsers(loadedUsers);
        setProjects(loadedProjects);
        selectedProjectRef.current = loadedProjects[0]?._id || "";
        setSelectedProjectId(selectedProjectRef.current);
      })
      .catch((error) => {
        if (active) setProjectMessage(error.message);
      });
    return () => { active = false; };
  }, []);

  // A project change clears the former project's details, form and backlog.
  // The active flag prevents an old project's fetch from overwriting newer data.
  useEffect(() => {
    let active = true;
    if (!selectedProjectId) return () => { active = false; };

    Promise.all([
      api(`/projects/${selectedProjectId}/members`),
      api(`/projects/${selectedProjectId}/stories`)
    ]).then(([loadedMembers, loadedStories]) => {
      if (!active) return;
      setMembers(loadedMembers);
      setStories(loadedStories);
      setBacklogMessage("");
    }).catch((error) => {
      if (!active) return;
      setMembers([]);
      setStories([]);
      setBacklogMessage(error.message);
    }).finally(() => {
      if (active) setIsLoadingBacklog(false);
    });

    return () => { active = false; };
  }, [selectedProjectId]);

  function switchProject(projectId) {
    selectedProjectRef.current = projectId;
    setSelectedProjectId(projectId);
    setMembers([]);
    setStories([]);
    setMemberUserId("");
    setMembershipMessage("");
    setStoryForm(EMPTY_STORY);
    setEditingStoryId(null);
    setOpenStoryId(null);
    setStoryMessage("");
    setBacklogMessage("");
    setIsLoadingBacklog(Boolean(projectId));
  }

  async function refreshUsers() {
    setUsers(await api("/users"));
  }

  async function refreshProjects(preferredProjectId) {
    try {
      const data = await api("/projects");
      setProjects(data);
      const desired = preferredProjectId || selectedProjectId;
      const nextId = data.some((item) => item._id === desired) ? desired : (data[0]?._id || "");
      if (nextId !== selectedProjectId) switchProject(nextId);
      setProjectMessage("");
    } catch (error) {
      setProjectMessage(error.message);
    }
  }

  async function refreshMembers(projectId = selectedProjectId) {
    if (!projectId) return;
    const loaded = await api(`/projects/${projectId}/members`);
    if (projectId === selectedProjectRef.current) setMembers(loaded);
  }

  async function refreshStories(projectId = selectedProjectId) {
    if (!projectId) return;
    const loaded = await api(`/projects/${projectId}/stories`);
    if (projectId === selectedProjectRef.current) setStories(loaded);
  }

  async function handleSignup(event) {
    event.preventDefault();
    try {
      const data = await api("/signup", {
        method: "POST", body: JSON.stringify({
          f_name: firstName, l_name: lastName, username, password
        })
      });
      setSignupMessage(data.message);
      setFirstName(""); setLastName(""); setUsername(""); setPassword("");
      await refreshUsers();
    } catch (error) {
      setSignupMessage(error.message);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    try {
      const data = await api("/login", {
        method: "POST", body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      setLoginMessage(data.message);
    } catch (error) {
      setLoginMessage(error.message);
    }
  }

  async function handleCreateProject(event) {
    event.preventDefault();
    try {
      const data = await api("/projects", {
        method: "POST", body: JSON.stringify({
          name: projectName,
          description: projectDescription,
          status: projectStatus,
          project_lead_id: projectLeadId
        })
      });
      setProjectName(""); setProjectDescription("");
      setProjectStatus("Planning"); setProjectLeadId("");
      await refreshProjects(data.project._id);
      setProjectMessage(data.message);
    } catch (error) {
      setProjectMessage(error.message);
    }
  }

  async function handleAddMember(event) {
    event.preventDefault();
    if (!selectedProjectId || !memberUserId) {
      setMembershipMessage("Select a project and a registered user.");
      return;
    }
    try {
      const projectId = selectedProjectId;
      const data = await api(`/projects/${projectId}/members`, {
        method: "POST", body: JSON.stringify({ user_id: memberUserId })
      });
      if (projectId === selectedProjectRef.current) {
        setMemberUserId("");
        await refreshMembers(projectId);
        setMembershipMessage(data.message);
      }
    } catch (error) {
      setMembershipMessage(error.message);
    }
  }

  async function handleRemoveMember(userId) {
    try {
      const projectId = selectedProjectId;
      const data = await api(`/projects/${projectId}/members/${userId}`, { method: "DELETE" });
      if (projectId === selectedProjectRef.current) {
        await refreshMembers(projectId);
        setMembershipMessage(data.message);
      }
    } catch (error) {
      setMembershipMessage(error.message);
    }
  }

  function startEditStory(story) {
    setEditingStoryId(story._id);
    setStoryForm({
      title: story.title,
      description: story.description,
      priority: story.priority,
      status: story.status,
      assigned_user_id: story.assigned_user_id || ""
    });
    setOpenStoryId(story._id);
    setStoryMessage("");
  }

  function cancelEditStory() {
    setEditingStoryId(null);
    setStoryForm(EMPTY_STORY);
    setStoryMessage("");
  }

  function updateStoryForm(field, value) {
    setStoryForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSaveStory(event) {
    event.preventDefault();
    if (!selectedProjectId) return;
    if (!storyForm.title.trim() || !storyForm.description.trim()) {
      setStoryMessage("Title and description are required.");
      return;
    }
    setIsSavingStory(true);
    setStoryMessage("");
    const projectId = selectedProjectId;
    const isEditing = Boolean(editingStoryId);
    try {
      const payload = {
        title: storyForm.title,
        description: storyForm.description,
        priority: storyForm.priority,
        assigned_user_id: storyForm.assigned_user_id || null,
        ...(isEditing ? { status: storyForm.status } : {})
      };
      const url = isEditing
        ? `/projects/${projectId}/stories/${editingStoryId}`
        : `/projects/${projectId}/stories`;
      const data = await api(url, {
        method: isEditing ? "PUT" : "POST",
        body: JSON.stringify(payload)
      });
      if (projectId === selectedProjectRef.current) {
        cancelEditStory();
        await refreshStories(projectId);
        setStoryMessage(data.message);
      }
    } catch (error) {
      setStoryMessage(error.message);
    } finally {
      setIsSavingStory(false);
    }
  }

  async function handleDeleteStory(story) {
    if (!window.confirm(`Delete the story "${story.title}"? This cannot be undone.`)) return;
    const projectId = selectedProjectId;
    try {
      const data = await api(`/projects/${projectId}/stories/${story._id}`, { method: "DELETE" });
      if (projectId === selectedProjectRef.current) {
        if (editingStoryId === story._id) cancelEditStory();
        if (openStoryId === story._id) setOpenStoryId(null);
        await refreshStories(projectId);
        setStoryMessage(data.message);
      }
    } catch (error) {
      setStoryMessage(error.message);
    }
  }

  return (
    <main className="app-container">
      <header className="page-header">
        <h1 className="title">Project Management</h1>
        <p>ICSI 418Y · PA4 — User Stories and Project Backlog</p>
      </header>

      <section aria-labelledby="account-heading">
        <h2 id="account-heading" className="section-title">Accounts (PA2)</h2>
        <div className="forms-container">
          <div className="card">
            <h3>Sign Up</h3>
            <form onSubmit={handleSignup}>
              <label>First name<input value={firstName} onChange={(e) => setFirstName(e.target.value)} required /></label>
              <label>Last name<input value={lastName} onChange={(e) => setLastName(e.target.value)} required /></label>
              <label>Username<input value={username} onChange={(e) => setUsername(e.target.value)} required /></label>
              <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
              <button type="submit">Create Account</button>
            </form>
            {signupMessage && <p className="message" role="status">{signupMessage}</p>}
          </div>
          <div className="card">
            <h3>Login</h3>
            <form onSubmit={handleLogin}>
              <label>Username<input value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} required /></label>
              <label>Password<input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required /></label>
              <button type="submit">Login</button>
            </form>
            {loginMessage && <p className="message" role="status">{loginMessage}</p>}
          </div>
        </div>
      </section>

      <section aria-labelledby="projects-heading">
        <h2 id="projects-heading" className="section-title">Projects (PA3)</h2>
        <div className="forms-container">
          <div className="card">
            <h3>Create Project</h3>
            <form onSubmit={handleCreateProject}>
              <label>Project name<input value={projectName} onChange={(e) => setProjectName(e.target.value)} required /></label>
              <label>Description<textarea value={projectDescription} onChange={(e) => setProjectDescription(e.target.value)} required rows="3" /></label>
              <label>Status<select value={projectStatus} onChange={(e) => setProjectStatus(e.target.value)}>
                <option>Planning</option><option>Active</option><option>Completed</option>
              </select></label>
              <label>Project Lead<select value={projectLeadId} onChange={(e) => setProjectLeadId(e.target.value)} required>
                <option value="">Select a registered user</option>
                {users.map((user) => <option key={user._id} value={user._id}>{displayName(user)}</option>)}
              </select></label>
              <button type="submit" disabled={!users.length}>Create Project</button>
            </form>
            {projectMessage && <p className="message" role="status">{projectMessage}</p>}
          </div>
          <div className="card">
            <div className="card-header"><h3>View Projects</h3><button className="button-inline secondary" type="button" onClick={() => refreshProjects()}>Refresh</button></div>
            {!projects.length ? <p className="muted">No projects found yet. Create a project first.</p> : (
              <div className="item-list">
                {projects.map((project) => <div className="project-item" key={project._id}>
                  <h4>{project.name}</h4>
                  <p>{project.description}</p>
                  <p><strong>Project status:</strong> {project.status}</p>
                  <p><strong>Lead:</strong> {project.project_lead ? displayName(project.project_lead) : "Unknown"}</p>
                </div>)}
              </div>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="select-heading" className="selection-section">
        <h2 id="select-heading" className="section-title">Selected Project</h2>
        <div className="card project-selector">
          <label htmlFor="selected-project">Choose the project for memberships and user stories</label>
          <select id="selected-project" value={selectedProjectId} onChange={(e) => switchProject(e.target.value)}>
            <option value="">Select a project</option>
            {projects.map((project) => <option key={project._id} value={project._id}>{project.name}</option>)}
          </select>
          {selectedProject && <p className="muted">Managing: <strong>{selectedProject.name}</strong></p>}
        </div>
      </section>

      <section aria-labelledby="membership-heading">
        <h2 id="membership-heading" className="section-title">Manage Project Memberships (PA3)</h2>
        <div className="forms-container">
          <div className="card">
            <h3>Current Members</h3>
            {!selectedProjectId ? <p className="muted">Select a project first.</p> : !members.length ? <p className="muted">No members found.</p> : (
              <div className="item-list">
                {members.map((member) => <div className="project-item member-item" key={member._id}>
                  <p><strong>{displayName(member)}</strong></p>
                  {member.isProjectLead ? <span className="chip">Project Lead</span> : (
                    <button type="button" className="secondary" onClick={() => handleRemoveMember(member._id)}>Remove Member</button>
                  )}
                </div>)}
              </div>
            )}
          </div>
          <div className="card">
            <h3>Add Member</h3>
            <form onSubmit={handleAddMember}>
              <label>Registered user<select value={memberUserId} onChange={(e) => setMemberUserId(e.target.value)} required disabled={!selectedProjectId}>
                <option value="">Select a registered user</option>
                {users.map((user) => <option key={user._id} value={user._id}>{displayName(user)}</option>)}
              </select></label>
              <button type="submit" disabled={!selectedProjectId || !memberUserId}>Add Member</button>
            </form>
            <p className="hint">Members with assigned stories cannot be removed until their stories are reassigned, unassigned, or deleted.</p>
            {membershipMessage && <p className="message" role="status">{membershipMessage}</p>}
          </div>
        </div>
      </section>

      <section aria-labelledby="stories-heading">
        <h2 id="stories-heading" className="section-title">User Stories and Project Backlog (PA4)</h2>
        <div className="forms-container story-layout">
          <div className="card">
            <h3>{editingStoryId ? "Edit User Story" : "Create User Story"}</h3>
            <form onSubmit={handleSaveStory}>
              <label>Title <span className="required">*</span>
                <input value={storyForm.title} onChange={(e) => updateStoryForm("title", e.target.value)} placeholder="View campus event details" required disabled={!selectedProjectId} />
              </label>
              <label>Description <span className="required">*</span>
                <textarea value={storyForm.description} onChange={(e) => updateStoryForm("description", e.target.value)} placeholder="As a student, I want to view campus event details, so that I can decide whether to attend." rows="5" required disabled={!selectedProjectId} />
              </label>
              <p className="hint">Use: As a [type of user], I want [goal], so that [benefit].</p>
              <label>Priority <span className="required">*</span><select value={storyForm.priority} onChange={(e) => updateStoryForm("priority", e.target.value)} disabled={!selectedProjectId}>
                <option>High</option><option>Medium</option><option>Low</option>
              </select></label>
              {editingStoryId && <label>Story status<select value={storyForm.status} onChange={(e) => updateStoryForm("status", e.target.value)}>
                <option>To Do</option><option>In Progress</option><option>Done</option>
              </select></label>}
              {!editingStoryId && <p className="hint">New stories automatically start as <strong>To Do</strong>.</p>}
              <label>Assigned Member<select value={storyForm.assigned_user_id} onChange={(e) => updateStoryForm("assigned_user_id", e.target.value)} disabled={!selectedProjectId}>
                <option value="">Unassigned</option>
                {members.map((member) => <option key={member._id} value={member._id}>{displayName(member)}{member.isProjectLead ? " — Lead" : ""}</option>)}
              </select></label>
              <div className="button-row">
                <button type="submit" disabled={!selectedProjectId || isSavingStory}>{isSavingStory ? "Saving..." : editingStoryId ? "Save Changes" : "Create Story"}</button>
                {editingStoryId && <button type="button" className="secondary" onClick={cancelEditStory}>Cancel</button>}
              </div>
            </form>
            {storyMessage && <p className="message" role="status">{storyMessage}</p>}
          </div>
          <div className="card backlog-card">
            <div className="card-header"><h3>Project Backlog</h3><button type="button" className="button-inline secondary" disabled={!selectedProjectId} onClick={async () => {
              try { await refreshStories(); setBacklogMessage(""); }
              catch (error) { setBacklogMessage(error.message); }
            }}>Refresh</button></div>
            {backlogMessage && <p className="message" role="alert">{backlogMessage}</p>}
            {!selectedProjectId ? <p className="muted">Choose a project to see its backlog.</p>
              : isLoadingBacklog ? <p className="muted">Loading project stories...</p>
              : stories.length === 0 ? <p className="empty-state">This project has no user stories yet. Create one using the form.</p>
              : <>
                <p className="muted">{stories.length} {stories.length === 1 ? "story" : "stories"} · Includes completed stories</p>
                <div className="item-list backlog-list">
                  {stories.map((story) => <article className="project-item story-item" key={story._id}>
                    <h4>{story.title}</h4>
                    <div className="chip-row">
                      <span className={`chip priority-${story.priority.toLowerCase()}`}>{story.priority} priority</span>
                      <span className="chip">{story.status}</span>
                    </div>
                    <p><strong>Assigned:</strong> {displayName(story.assigned_user)}</p>
                    {openStoryId === story._id && <div className="story-description"><strong>Description</strong><p>{story.description}</p></div>}
                    <div className="button-row story-buttons">
                      <button type="button" className="secondary" onClick={() => setOpenStoryId(openStoryId === story._id ? null : story._id)}>{openStoryId === story._id ? "Hide Details" : "View Details"}</button>
                      <button type="button" onClick={() => startEditStory(story)}>Edit</button>
                      <button type="button" className="danger" onClick={() => handleDeleteStory(story)}>Delete</button>
                    </div>
                  </article>)}
                </div>
              </>}
          </div>
        </div>
      </section>
      <footer>Stories are stored as separate MongoDB documents and stay in their original project.</footer>
    </main>
  );
}

export default App;
