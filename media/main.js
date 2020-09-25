var addButton = document.getElementById("addButton");
var removeButton = document.getElementById("removeButton");
var processButton = document.getElementById("processButton");
processButton.disabled = true;

var mpackages = document.getElementById("mpackages");
var spackages = document.getElementById("spackages");

addButton.addEventListener("click", () => moveItems(mpackages, spackages));
removeButton.addEventListener("click", () => moveItems(spackages, mpackages));
processButton.addEventListener("click", processPackages);

var divFqdns = document.getElementById("divFqdns");
console.log(divFqdns);
var divUsernames = document.getElementById("divUsernames");
console.log(divUsernames);
var divFqdn = document.getElementById("divFqdn");
var divUsername = document.getElementById("divUsername");

var fqdnsText = divFqdns.innerHTML;
console.log(`fqdnsText: ${fqdnsText}`);

var fqdns = fqdnsText.split(',');
console.log(`fqdns: ${fqdns}`);

var usernamesText = divUsernames.innerHTML;
console.log(`usernamesText: ${usernamesText}`);

var usernames = usernamesText.split(',');
console.log(`usernames: ${usernames}`);

processInput(fqdns, divFqdn, 'taniumServerFqdn');
processInput(usernames, divUsername, 'taniumServerUsername');

var taniumServerFqdn = document.getElementById("taniumServerFqdn");
var taniumServerUsername = document.getElementById("taniumServerUsername");
var taniumServerPassword = document.getElementById("taniumServerPassword");

var taniumServerFqdnSelect = document.getElementById("taniumServerFqdnSelect");
var taniumServerUsernameSelect = document.getElementById("taniumServerUsernameSelect");

taniumServerPassword.addEventListener("input", enableProcessPackage);

function processInput(inputArray, targetDiv, targetId) {
    if (inputArray.length === 1) {
        // add input element
        var tag = document.createElement("input");
        tag.setAttribute("id", targetId);
        var text = document.createTextNode(item);
        tag.appendChild(text);
        tag.addEventListener("input", enableProcessPackage);
        targetDiv.appendChild(tag);
    } else {
        var tag = document.createElement("select");
        tag.setAttribute("id", `${targetId}Select`);
        targetDiv.appendChild(tag);

        for (var i = 0; i < inputArray.length; i++) {
            var item = inputArray[i];
            var option = document.createElement("option");
            option.setAttribute("value", item);
            var text = document.createTextNode(item);
            option.appendChild(text);
            tag.appendChild(option);
        }

        // set selected index
        tag.selectedIndex = inputArray.length - 1;
    }
}

function enableProcessPackage() {
    var hasNoData = taniumServerFqdn?.value.trim().length === 0 || taniumServerUsername?.value.trim().length === 0 || taniumServerPassword.value.trim().length === 0;
    processButton.disabled = hasNoData;
}

function moveItems(from, to) {
    if (from.selectedIndex === -1) {
        return;
    }

    for (var i = 0; i < from.options.length; i++) {
        var o = from.options[i];

        if (o.selected) {
            to.options[to.options.length] = new Option(o.text, o.value);
        }
    }

    for (var i = from.options.length - 1; i >= 0; i--) {
        var o = from.options[i];

        if (o.selected) {
            from.options[i] = null;
        }
    }
}

function processPackages() {
    const vscode = acquireVsCodeApi();

    console.log(`select: ${taniumServerFqdnSelect.value}`);

    const fqdn = taniumServerFqdn === null ? taniumServerFqdnSelect.value : taniumServerFqdn.value;
    const username = taniumServerUsername === null ? taniumServerUsernameSelect.value : taniumServerUsername.value;

    console.log(`fqdn: ${fqdn}`);

    // process all items
    for (var i = 0; i < spackages.options.length; i++) {
        // send message
        vscode.postMessage({
            command: 'transferPackage',
            fqdn: fqdn,
            username: username,
            password: taniumServerPassword.value,
        });
    }
}