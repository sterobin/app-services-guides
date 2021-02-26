import {QuickStart, QuickStartSpec, QuickStartTask} from "@cloudmosaic/quickstarts";

export const ProcQuickStartParser = (
    quickStart: QuickStart,
    environmentVariables?: { [name: string]: string }
) => {
    const replaceEnvironmentVariables = (s: string | undefined) =>
        s?.replace(/\${(\w+)}/, (substring, name) => {
            return environmentVariables ? [name]
                ? environmentVariables[name]
                : substring : substring;
        });

    quickStart.spec.tasks?.forEach((task: QuickStartTask, index) => {
        if (task["proc"]) {
            const taskDOM = document.createElement("div");
            taskDOM.innerHTML = task["proc"];
            let description, procedure, verification, title: string | undefined;
            title = taskDOM.querySelector("h1:first-child,h2:first-child,h3:first-child,h4:first-child,h5:first-child")?.innerHTML.trim();
            let sectionBody = taskDOM.querySelector(".sectionbody");
            if (!sectionBody?.hasChildNodes()) {
                // possibly in other templates, where we want to look for article
                sectionBody = taskDOM.querySelector("article");
            }
            if (sectionBody) {
                for (let i = 0; i < sectionBody.children.length || 0; i++) {
                    const child = sectionBody.children.item(i);
                    // find the title
                    const title = child?.querySelector(".heading,.title");
                    if (title) {
                        switch (title?.textContent?.trim()) {
                            case "Procedure":
                                procedure = child?.querySelector(":not(.heading,.title)")?.outerHTML.trim();
                                break;
                            case "Verification":
                                verification = child?.querySelector(":not(.heading,.title)")?.outerHTML.trim();
                                break;
                        }
                    } else if (!procedure) {
                        // Otherwise if it comes before a procedure it's part of the description
                        description = child?.innerHTML.trim();
                    }
                }
            }

            task.title = replaceEnvironmentVariables(task.title || title)
            task.description = replaceEnvironmentVariables(task.description || `${description} ${procedure}`);
            task.review = task.review || {};
            task.review.instructions = replaceEnvironmentVariables(task.review?.instructions || verification || "Have you completed these steps?")
            task.review.failedTaskHelp = replaceEnvironmentVariables(task.review.failedTaskHelp || taskDOM.querySelector(".qs-review.failed")?.innerHTML.trim() || "This task isn’t verified yet. Try the task again.");
            task.summary = task.summary || {};
            task.summary.success = replaceEnvironmentVariables(task.summary.success ||
                taskDOM.querySelector(".qs-summary.success")?.innerHTML.trim()
                || "You have completed this task!");
            task.summary.failed = replaceEnvironmentVariables(task.summary.failed ||
                taskDOM.querySelector(".qs-summary.failed")?.innerHTML.trim() || "Try the steps again.");
        }
    });
    return quickStart;
};
