Thanisha Raj
Icsi 418Y
Fourth assignment : User Stories and Project Backlog

Description: This project builds on from pa2, and pa3. Create, view, edit, assign, prioritize, and delete user stories within a selected project.


------------------⛧°。 ⋆༺♱༻⋆。 °⛧------------------


Instructions:

Starting the Backend:
-Open a terminal and run
cd server
npm install
node server.js

terminal should then display this output
Connected to MongoDB database: pa2
Server running on http://localhost:3000

Starting the Frontend:
-Open a second terminal and run
cd client
npm install
npm run dev

Terminal should display
http://localhost:5173/
this is the link to open on your browser


------------------⛧°。 ⋆༺♱༻⋆。 °⛧------------------


Create or Select a Project (PA3)

1.In Projects (PA3), enter a Project name and Description.
2.Choose a project Status: Planning, Active, or Completed.
3.Choose a registered user as Project Lead.
4.Click 'Create Project' , or use a project that already exists.
5.Scroll to 'Selected Project' and choose the project from the dropdown labeled Choose the project for memberships and user stories.

*IMPORTANT TO NOTE*: The PA4 story form is disabled until a project is selected.

Step 3: Add Project Members (Optional if you already have existing members)

1.Find Manage Project Memberships (PA3).

2.Under Add Member, choose a registered user.

3.Click Add Member.

The project lead is automatically a member when the project is created. Additional members can be added as needed. A user story can only be assigned to a member of the selected project; you may also leave a story Unassigned.


------------------⛧°。 ⋆༺♱༻⋆。 °⛧------------------


Step 4: Create a User Story (PA4)

1.Scroll to User Stories and Project Backlog (PA4).
2.Under Create User Story, the following fields should be completed:
   -Title (required): A short name for the feature.
   -Description (required): Explain the feature from the user's perspective.
   -Priority (required): Choose High, Medium, or Low.
   -Assigned Member: Choose a project member or Unassigned.

3.Click Create Story.

4.The new story will appear in Project Backlog with its status automatically set to 'To Do'.

Example user story:
   -Title: Browse Upcoming Campus Events
   -Description: As a student, I want to browse upcoming campus events, so that I can decide which events to attend.
   -Priority: High
   -Assigned Member: Select a project member or Unassigned
   -Initial Status: To Do (set automatically)

Step 5: View, Edit, or Delete a Story
In the Project Backlog section:
   -View Details: Expand a story to read its full description.
   -Edit: Load the story into the edit form. Change its title, description, priority, assigned member, or status; then click Save Changes.
   -Delete: Click Delete and confirm to permanently remove the story.
   -Refresh: Reload the selected project's backlog from the backend.

Stories marked Done remain visible in the backlog. Switching projects displays the stories that belong to the newly selected project.

Project Membership Rules
   -The project lead cannot be removed through the membership interface.
   -A member who has assigned stories in a project cannot be removed until those stories are reassigned, unassigned, or deleted.
   -This rule also applies to stories marked Done.
   -A story cannot be moved to a different project by editing it.


------------------⛧°。 ⋆༺♱༻⋆。 °⛧------------------


Troubleshooting - *Note for self*
The browser says “Could not connect to the backend” :
-Confirm that node server.js is still running in the server terminal and that port 3000 is available.

MongoDB authentication fails :
-Check the database username and password in server/.env. Use the info for MongoDB database user.

The PA4 fields are disabled :
-Choose a project in the Selected Project dropdown first.

No users or projects appear :
-Confirm that the backend is connected to the correct database (MONGO_DB_NAME) and that users/projects exist there.

The browser shows a blank page when using Live Server : 
-Start the React frontend with npm run dev inside client, then open the URL Vite displays.

-To stop either server, click its terminal and press Ctrl + C.