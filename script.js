// =====================================
// TASK MANAGER APPLICATION
// =====================================

// Get saved tasks from localStorage
let tasks = JSON.parse(localStorage.getItem("tasks")) || [];

// Save tasks in browser
function saveTasks() {
localStorage.setItem("tasks", JSON.stringify(tasks));
}

// Add a new task
function addTask() {

```
const input = document.getElementById("taskTitle");
const title = input.value.trim();

// Check empty task
if (title === "") {
    alert("Please enter a task name.");
    return;
}

// Create task object
const newTask = {
    id: Date.now(),
    title: title,
    status: "backlog"
};

// Add task
tasks.push(newTask);

// Save and update screen
saveTasks();
displayTasks();

// Clear input
input.value = "";
```

}

// Display tasks on the board
function displayTasks() {

```
// Clear all columns
document.getElementById("backlog").innerHTML = "";
document.getElementById("assigned").innerHTML = "";
document.getElementById("checkout").innerHTML = "";
document.getElementById("completed").innerHTML = "";


// Display each task
tasks.forEach(function(task) {

    const card = createTaskCard(task);

    const column = document.getElementById(task.status);

    column.appendChild(card);

});


updateCounts();
```

}

// Create one task card
function createTaskCard(task) {

```
const card = document.createElement("div");
card.className = "task-card";


// Task name
const title = document.createElement("h3");
title.textContent = task.title;

// Open task details page
title.onclick = function() {
    openTask(task.id);
};


// Task ID
const id = document.createElement("p");
id.textContent = "Task ID: " + task.id;


// Buttons
const actions = document.createElement("div");
actions.className = "task-actions";


// Move task button
const moveButton = document.createElement("button");
moveButton.className = "move-button";
moveButton.textContent = getNextButtonText(task.status);

moveButton.onclick = function() {
    moveTask(task.id);
};


// Delete task button
const deleteButton = document.createElement("button");
deleteButton.className = "delete-button";
deleteButton.textContent = "Delete";

deleteButton.onclick = function() {
    deleteTask(task.id);
};


// Add buttons to actions
actions.appendChild(moveButton);
actions.appendChild(deleteButton);


// Add elements to card
card.appendChild(title);
card.appendChild(id);
card.appendChild(actions);


return card;
```

}

// Move task to the next column
function moveTask(id) {

```
const task = tasks.find(function(task) {
    return task.id === id;
});

if (!task) {
    return;
}


if (task.status === "backlog") {
    task.status = "assigned";
}
else if (task.status === "assigned") {
    task.status = "checkout";
}
else if (task.status === "checkout") {
    task.status = "completed";
}
else {
    task.status = "backlog";
}


saveTasks();
displayTasks();
```

}

// Button text based on status
function getNextButtonText(status) {

```
if (status === "backlog") {
    return "Assign →";
}

if (status === "assigned") {
    return "Checkout →";
}

if (status === "checkout") {
    return "Complete ✓";
}

return "Reopen ↺";
```

}

// Delete one task
function deleteTask(id) {

```
const answer = confirm("Are you sure you want to delete this task?");

if (!answer) {
    return;
}

tasks = tasks.filter(function(task) {
    return task.id !== id;
});

saveTasks();
displayTasks();
```

}

// Open task details page
function openTask(id) {

```
window.location.href = "task.html?id=" + id;
```

}

// Update task counts
function updateCounts() {

```
const backlogCount = tasks.filter(function(task) {
    return task.status === "backlog";
}).length;

const assignedCount = tasks.filter(function(task) {
    return task.status === "assigned";
}).length;

const checkoutCount = tasks.filter(function(task) {
    return task.status === "checkout";
}).length;

const completedCount = tasks.filter(function(task) {
    return task.status === "completed";
}).length;


document.getElementById("backlogCount").textContent = backlogCount;
document.getElementById("assignedCount").textContent = assignedCount;
document.getElementById("checkoutCount").textContent = checkoutCount;
document.getElementById("completedCount").textContent = completedCount;
```

}

// Clear all tasks
function clearAllTasks() {

```
const answer = confirm(
    "Are you sure you want to delete ALL tasks?"
);

if (!answer) {
    return;
}

tasks = [];

saveTasks();
displayTasks();
```

}

// Add task when user presses Enter
document.getElementById("taskTitle").addEventListener(
"keydown",
function(event) {

```
    if (event.key === "Enter") {
        addTask();
    }

}
```

);

// Start the application
displayTasks();
