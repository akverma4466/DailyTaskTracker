/* =========================
   TASK TRACKER
========================= */

let tasks = [];

// HTML elements
const taskForm = document.getElementById("taskForm");
const taskName = document.getElementById("taskName");
const taskDate = document.getElementById("taskDate");
const taskCategory = document.getElementById("taskCategory");
const taskPriority = document.getElementById("taskPriority");
const taskList = document.getElementById("taskList");

// Dashboard elements
const totalTasks = document.getElementById("totalTasks");
const completedTasks = document.getElementById("completedTasks");
const pendingTasks = document.getElementById("pendingTasks");
const progress = document.getElementById("progress");
const daysCompleted = document.getElementById("daysCompleted");
const consistencyRate = document.getElementById("consistencyRate");

// Use local calendar date instead of UTC date
function getTodayDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

/* =========================
   ADD TASK
========================= */

taskForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const {
        data: { user },
        error: userError
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
        alert("Please log in before adding tasks.");
        return;
    }

    const name = taskName.value.trim();
    const category = taskCategory.value;
    const priority = taskPriority.value;

    if (!name || !category) {
        alert("Please enter a task name and select a category.");
        return;
    }

    const selectedTaskDate = taskDate.value || null;

    const { data, error } = await supabaseClient
        .from("tasks")
        .insert({
            user_id: user.id,
            title: name,
            task_date: selectedTaskDate,
            category: category,
            priority: priority,
            completed: false
        })
        .select()
        .single();

    if (error) {
        alert("Could not save task: " + error.message);
        return;
    }

    tasks.push({
        id: data.id,
        name: data.title,
        category: data.category,
        priority: data.priority,
        completed: false
    });

    taskForm.reset();
    renderTasks();
    await updateDaysCompleted();
});

/* =========================
   DISPLAY TASKS
========================= */

function renderTasks() {
    taskList.replaceChildren();

    if (tasks.length === 0) {
        taskList.textContent = "No tasks added yet.";
        updateDashboard();
        return;
    }

    tasks.forEach(function(task) {
        const card = document.createElement("div");
        card.className = "task-card";

        const title = document.createElement("h3");
        title.textContent = task.name;

        const details = document.createElement("p");
        details.textContent =
            "Category: " + task.category +
            " | Priority: " + task.priority;

        const status = document.createElement("p");
        status.textContent = task.completed ?
            "Status: Completed" :
            "Status: Pending";

        const completeButton = document.createElement("button");
        completeButton.textContent = task.completed ?
            "Mark Pending" :
            "Mark Completed";

        completeButton.addEventListener("click", async function() {
            completeButton.disabled = true;

            try {
                const {
                    data: { user },
                    error: userError
                } = await supabaseClient.auth.getUser();

                if (userError || !user) {
                    alert("Please log in again.");
                    return;
                }

                const today = getTodayDate();
                const newStatus = !task.completed;

                const { error } = await supabaseClient
                    .from("daily_task_completions")
                    .upsert({
                        task_id: task.id,
                        user_id: user.id,
                        completion_date: today,
                        completed: newStatus
                    }, {
                        onConflict: "task_id,completion_date"
                    });

                if (error) {
                    alert(
                        "Could not update today's completion: " +
                        error.message
                    );
                    return;
                }

                task.completed = newStatus;
                renderTasks();
                await updateDaysCompleted();

            } catch (error) {
                console.error("Could not update task:", error);
                alert("An unexpected error occurred while updating the task.");
            } finally {
                completeButton.disabled = false;
            }
        });

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";

        deleteButton.addEventListener("click", async function() {
            if (!confirm("Are you sure you want to delete this task?")) {
                return;
            }

            deleteButton.disabled = true;

            try {
                const {
                    data: { user },
                    error: userError
                } = await supabaseClient.auth.getUser();

                if (userError || !user) {
                    alert("Please log in again.");
                    return;
                }

                const { error } = await supabaseClient
                    .from("tasks")
                    .delete()
                    .eq("id", task.id)
                    .eq("user_id", user.id);

                if (error) {
                    alert("Could not delete task: " + error.message);
                    return;
                }

                tasks = tasks.filter(function(item) {
                    return item.id !== task.id;
                });

                renderTasks();
                await updateDaysCompleted();

            } catch (error) {
                console.error("Could not delete task:", error);
                alert("An unexpected error occurred while deleting the task.");
            } finally {
                deleteButton.disabled = false;
            }
        });

        card.append(
            title,
            details,
            status,
            completeButton,
            deleteButton
        );

        taskList.appendChild(card);
    });

    updateDashboard();
}

/* =========================
   DASHBOARD STATISTICS
========================= */

function updateDashboard() {
    const total = tasks.length;

    const completedToday = tasks.filter(function(task) {
        return task.completed;
    }).length;

    const pendingToday = total - completedToday;

    const dailyPercentage = total === 0 ?
        0 :
        Math.round((completedToday / total) * 100);

    totalTasks.textContent = total;
    completedTasks.textContent = completedToday;
    pendingTasks.textContent = pendingToday;
    progress.textContent = dailyPercentage + "%";

    document.getElementById("allTimeTasks").textContent = total;
}

/* =========================
   HISTORY DATE
========================= */

const reportDate = document.getElementById("reportDate");

reportDate.value = getTodayDate();

/* =========================
   DISPLAY DAILY HISTORY
========================= */

async function renderHistory() {
    const selectedDate = reportDate.value;
    const historySummary = document.getElementById("historySummary");
    const dailyHistory = document.getElementById("dailyHistory");

    if (!selectedDate) {
        historySummary.textContent = "Please select a date.";
        dailyHistory.replaceChildren();
        return;
    }

    historySummary.textContent = "Loading history...";
    dailyHistory.replaceChildren();

    const {
        data: { user },
        error: userError
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
        historySummary.textContent = "Please log in to view history.";
        return;
    }

    const { data: taskData, error: taskError } = await supabaseClient
        .from("tasks")
        .select("id")
        .eq("user_id", user.id);

    if (taskError) {
        historySummary.textContent = "Could not load tasks.";
        console.error("Could not load history tasks:", taskError.message);
        return;
    }

    const { data: completionData, error: completionError } =
    await supabaseClient
        .from("daily_task_completions")
        .select("task_id, completion_date, completed")
        .eq("user_id", user.id)
        .lte("completion_date", selectedDate)
        .order("completion_date", { ascending: false });

    if (completionError) {
        historySummary.textContent =
            "Could not load completion history.";
        console.error(
            "Could not load completion history:",
            completionError.message
        );
        return;
    }

    const allTasks = taskData || [];
    const allRecords = completionData || [];
    const total = allTasks.length;

    const selectedDayRecords = allRecords.filter(function(record) {
        return record.completion_date === selectedDate &&
            record.completed;
    });

    const completedSelectedDay = selectedDayRecords.filter(function(record) {
        return allTasks.some(function(task) {
            return task.id === record.task_id;
        });
    }).length;

    const dailyPercentage = total === 0 ?
        0 :
        Math.round((completedSelectedDay / total) * 100);

    historySummary.textContent =
        "Progress on " + selectedDate +
        ": " + completedSelectedDay + "/" + total +
        " completed (" + dailyPercentage + "%)";

    const dates = [...new Set(
        allRecords.map(function(record) {
            return record.completion_date;
        })
    )];

    if (dates.length === 0) {
        dailyHistory.textContent =
            "No completion records found up to this date.";
        return;
    }

    dates.forEach(function(date) {
        const dayRecords = allRecords.filter(function(record) {
            return record.completion_date === date &&
                record.completed;
        });

        const completedCount = dayRecords.filter(function(record) {
            return allTasks.some(function(task) {
                return task.id === record.task_id;
            });
        }).length;

        const dayPercentage = total === 0 ?
            0 :
            Math.round((completedCount / total) * 100);

        const row = document.createElement("div");
        row.className = "history-row";

        const dateText = document.createElement("strong");
        dateText.textContent = date;

        const details = document.createElement("span");
        details.textContent =
            completedCount + "/" + total +
            " completed (" + dayPercentage + "%)";

        row.append(dateText, details);
        dailyHistory.appendChild(row);
    });
}

/* =========================
   LOAD TASKS FOR HISTORY
========================= */

async function loadHistoryTasks() {
    const selectedDate = reportDate.value;
    const historyTasks = document.getElementById("historyTasks");

    historyTasks.replaceChildren();

    if (!selectedDate) {
        historyTasks.textContent = "Please select a date.";
        return;
    }

    const {
        data: { user },
        error: userError
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
        historyTasks.textContent = "Please log in again.";
        return;
    }

    const { data: taskData, error: taskError } = await supabaseClient
        .from("tasks")
        .select("id, title, category, priority, created_at, task_date")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    if (taskError) {
        historyTasks.textContent =
            "Could not load tasks: " + taskError.message;
        return;
    }

    const { data: completionData, error: completionError } =
    await supabaseClient
        .from("daily_task_completions")
        .select("task_id, completed")
        .eq("user_id", user.id)
        .eq("completion_date", selectedDate);

    if (completionError) {
        historyTasks.textContent =
            "Could not load completion status: " +
            completionError.message;
        return;
    }

    const allTasks = taskData || [];
    const allCompletions = completionData || [];

    const tasksForDate = allTasks.filter(function(task) {
        return !task.task_date || task.task_date <= selectedDate;
    });

    if (tasksForDate.length === 0) {
        historyTasks.textContent = "No tasks existed on this date.";
        return;
    }

    tasksForDate.forEach(function(task) {
        const record = allCompletions.find(function(item) {
            return item.task_id === task.id;
        });

        const isCompleted = record ? record.completed : false;

        const row = document.createElement("div");
        row.className = "history-row";

        const label = document.createElement("label");
        const checkbox = document.createElement("input");

        checkbox.type = "checkbox";
        checkbox.checked = isCompleted;

        const name = document.createElement("span");
        name.textContent = task.title + " (" + task.category + ")";

        label.append(checkbox, name);

        const status = document.createElement("span");
        status.textContent = isCompleted ? "Completed" : "Pending";

        checkbox.addEventListener("change", async function() {
            checkbox.disabled = true;

            const requestedStatus = checkbox.checked;

            try {
                const { error } = await supabaseClient
                    .from("daily_task_completions")
                    .upsert({
                        task_id: task.id,
                        user_id: user.id,
                        completion_date: selectedDate,
                        completed: requestedStatus
                    }, {
                        onConflict: "task_id,completion_date"
                    });

                if (error) {
                    alert("Could not save status: " + error.message);
                    checkbox.checked = !requestedStatus;
                    return;
                }

                status.textContent = requestedStatus ?
                    "Completed" :
                    "Pending";

                await renderHistory();
                await updateDaysCompleted();

                if (selectedDate === getTodayDate()) {
                    await loadTasksForCurrentUser();
                }

            } catch (error) {
                console.error("Could not save history status:", error);
                alert("An unexpected error occurred while saving status.");
                checkbox.checked = !requestedStatus;
            } finally {
                checkbox.disabled = false;
            }
        });

        row.append(label, status);
        historyTasks.appendChild(row);
    });
}

/* =========================
   HISTORY DATE CHANGE
========================= */

reportDate.addEventListener("change", function() {
    renderHistory();
    loadHistoryTasks();
});

/* =========================
   AUTHENTICATION ELEMENTS
========================= */

const authForm = document.getElementById("authForm");
const signupBtn = document.getElementById("signupBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userBar = document.getElementById("userBar");
const userEmail = document.getElementById("userEmail");
const authMessage = document.getElementById("authMessage");
const authSection = document.getElementById("authSection");
const dashboardSection = document.getElementById("dashboardSection");

/* =========================
   LOGIN
========================= */

authForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;

    authMessage.textContent = "Logging in...";

    const { error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        authMessage.textContent = error.message;
        return;
    }

    authMessage.textContent = "Login successful!";
});

/* =========================
   SIGNUP
========================= */

signupBtn.addEventListener("click", async function() {
    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;

    if (!email || password.length < 6) {
        authMessage.textContent =
            "Enter a valid email and a password of at least 6 characters.";
        return;
    }

    authMessage.textContent = "Creating your account...";

    const { error } = await supabaseClient.auth.signUp({
        email: email,
        password: password
    });

    if (error) {
        authMessage.textContent = error.message;
        return;
    }

    authMessage.textContent =
        "Registration submitted. Check your email if confirmation is required.";
});

/* =========================
   LOGOUT
========================= */

logoutBtn.addEventListener("click", async function() {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        authMessage.textContent = error.message;
        return;
    }

    authMessage.textContent = "Logged out successfully.";
});

/* =========================
   UPDATE LOGIN VIEW
========================= */

async function updateAuthView() {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
        authMessage.textContent = error.message;
        console.error("Could not retrieve session:", error.message);
        return;
    }

    const session = data.session;
    const loggedIn = Boolean(session);

    authSection.hidden = loggedIn;
    dashboardSection.hidden = !loggedIn;
    userBar.hidden = !loggedIn;

    if (loggedIn) {
        const email = session.user.email || "Signed-in user";
        userEmail.textContent = email;

        const avatar = document.querySelector(".user-avatar");

        if (avatar) {
            avatar.textContent = email.charAt(0).toUpperCase();
        }

        await loadTasksForCurrentUser();
        await updateDaysCompleted();
        await renderHistory();
        await loadHistoryTasks();
    } else {
        tasks = [];
        renderTasks();

        daysCompleted.textContent = "0";
        consistencyRate.textContent = "0% average daily completion";
        document.getElementById("overallProgress").textContent = "0%";

        document.getElementById("historySummary").textContent =
            "Please log in to view history.";

        document.getElementById("dailyHistory").replaceChildren();
        document.getElementById("historyTasks").replaceChildren();
    }
}

supabaseClient.auth.onAuthStateChange(function() {
    updateAuthView();
});

/* =========================
   LOAD USER'S TASKS
========================= */

async function loadTasksForCurrentUser() {
    const {
        data: { user },
        error: userError
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
        tasks = [];
        renderTasks();
        return;
    }

    const today = getTodayDate();

    const { data: taskData, error: taskError } = await supabaseClient
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    if (taskError) {
        console.error("Could not load tasks:", taskError.message);
        alert("Could not load tasks: " + taskError.message);
        return;
    }

    const { data: completionData, error: completionError } =
    await supabaseClient
        .from("daily_task_completions")
        .select("task_id, completed")
        .eq("user_id", user.id)
        .eq("completion_date", today);

    if (completionError) {
        console.error(
            "Could not load daily completions:",
            completionError.message
        );
        alert(
            "Could not load daily completion status: " +
            completionError.message
        );
        return;
    }

    const allTasks = taskData || [];
    const allCompletions = completionData || [];

    tasks = allTasks.map(function(row) {
        const dailyRecord = allCompletions.find(function(record) {
            return record.task_id === row.id;
        });

        return {
            id: row.id,
            name: row.title,
            category: row.category,
            priority: row.priority,
            completed: dailyRecord ? dailyRecord.completed : false
        };
    });

    renderTasks();
}

/* =========================
   HISTORICAL DASHBOARD
========================= */

async function updateDaysCompleted() {
    const {
        data: { user },
        error: userError
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
        daysCompleted.textContent = "0";
        consistencyRate.textContent = "0% average daily completion";
        document.getElementById("overallProgress").textContent = "0%";
        return;
    }

    const { data, error } = await supabaseClient
        .from("daily_task_completions")
        .select("completion_date, task_id, completed")
        .eq("user_id", user.id)
        .eq("completed", true);

    if (error) {
        console.error("Could not load completed days:", error.message);
        return;
    }

    const records = data || [];

    const completedDates = new Set(
        records.map(function(record) {
            return record.completion_date;
        })
    );

    daysCompleted.textContent = completedDates.size;

    const { data: taskData, error: taskError } = await supabaseClient
        .from("tasks")
        .select("id")
        .eq("user_id", user.id);

    if (taskError) {
        console.error("Could not load tasks for dashboard:", taskError.message);
        return;
    }

    const allTasks = taskData || [];

    if (records.length === 0 || allTasks.length === 0) {
        consistencyRate.textContent = "0% average daily completion";
        document.getElementById("overallProgress").textContent = "0%";
        return;
    }

    const dailyPercentages = [];

    completedDates.forEach(function(date) {
        const completedIds = new Set(
            records
            .filter(function(record) {
                return record.completion_date === date;
            })
            .map(function(record) {
                return record.task_id;
            })
        );

        const completedCount = allTasks.filter(function(task) {
            return completedIds.has(task.id);
        }).length;

        dailyPercentages.push(
            (completedCount / allTasks.length) * 100
        );
    });

    const average = dailyPercentages.length === 0 ?
        0 :
        Math.round(
            dailyPercentages.reduce(function(sum, value) {
                return sum + value;
            }, 0) / dailyPercentages.length
        );

    consistencyRate.textContent =
        average + "%" + " average daily completion";

    document.getElementById("overallProgress").textContent =
        average + "%";
}

/* =========================
   INITIAL DISPLAY
========================= */

renderTasks();
renderHistory();
loadHistoryTasks();
updateAuthView();