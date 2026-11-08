const PRIORITIES = ["High", "Medium", "Low"];
const STORY_STATUSES = ["To Do", "In Progress", "Done"];
const PROJECT_STATUSES = ["Planning", "Active", "Completed"];

function isObjectIdString(value) {
  return typeof value === "string" && /^[0-9a-fA-F]{24}$/.test(value);
}

function validateStory(body, { isEdit = false, projectId } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "A story object is required." };
  }

  // A story can never be transferred to a different project.
  if (body.project_id !== undefined && body.project_id !== projectId) {
    return { error: "A story cannot be moved to a different project." };
  }

  const { title, description, priority, status, assigned_user_id } = body;

  if (typeof title !== "string" || !title.trim()) {
    return { error: "Story title is required." };
  }
  if (typeof description !== "string" || !description.trim()) {
    return { error: "Story description is required." };
  }
  if (!PRIORITIES.includes(priority)) {
    return { error: "Story priority must be High, Medium, or Low." };
  }
  if (isEdit && !STORY_STATUSES.includes(status)) {
    return { error: "Story status must be To Do, In Progress, or Done." };
  }
  if (!isEdit && status !== undefined && !STORY_STATUSES.includes(status)) {
    return { error: "Unsupported story status." };
  }

  // Unassigned may be sent as null, omitted, or an empty option value.
  const assignee = assigned_user_id === undefined || assigned_user_id === null ||
    assigned_user_id === "" ? null : assigned_user_id;
  if (assignee !== null && !isObjectIdString(assignee)) {
    return { error: "Invalid assigned member ID." };
  }

  return {
    value: {
      title: title.trim(),
      description: description.trim(),
      priority,
      // The server chooses To Do for every new story, regardless of input.
      status: isEdit ? status : "To Do",
      assigned_user_id: assignee
    }
  };
}

module.exports = {
  PRIORITIES,
  STORY_STATUSES,
  PROJECT_STATUSES,
  isObjectIdString,
  validateStory
};
