const vscode = acquireVsCodeApi();

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
var divSigningKeys = document.getElementById("divSigningKeys");
console.log(divSigningKeys);

var divSourceFqdn = document.getElementById("divSourceFqdn");
var divDestFqdn = document.getElementById("divDestFqdn");
var divUsername = document.getElementById("divUsername");
var divSigningKey = document.getElementById("divSigningKey");

var fqdnsText = divFqdns.innerHTML;
console.log(`fqdnsText: ${fqdnsText}`);

var fqdns = fqdnsText.split(',');
console.log(`fqdns: ${fqdns}`);

var usernamesText = divUsernames.innerHTML;
console.log(`usernamesText: ${usernamesText}`);

var usernames = usernamesText.split(',');
console.log(`usernames: ${usernames}`);

var signingKeysText = divSigningKeys.innerHTML;
console.log(signingKeysText);

var signingKeys = signingKeysText.split(',');

processInput(fqdns, divSourceFqdn, 'taniumSourceServerFqdn', false);
processInput(fqdns, divDestFqdn, 'taniumDestServerFqdn', true);
processInput(usernames, divUsername, 'taniumServerUsername', true);
processInput(signingKeys, divSigningKey, 'taniumSigningKey', true);

var taniumSourceServerFqdn = document.getElementById("taniumSourceServerFqdn");
var taniumDestServerFqdn = document.getElementById("taniumDestServerFqdn");
var taniumServerUsername = document.getElementById("taniumServerUsername");
var taniumServerPassword = document.getElementById("taniumServerPassword");
var taniumSigningKey = document.getElementById("taniumSigningKey");

var taniumSourceServerFqdnSelect = document.getElementById("taniumSourceServerFqdnSelect");
var taniumDestServerFqdnSelect = document.getElementById("taniumDestServerFqdnSelect");
var taniumServerUsernameSelect = document.getElementById("taniumServerUsernameSelect");
var taniumSigningKeySelect = document.getElementById("taniumSigningKeySelect");

taniumServerPassword.addEventListener("input", enableProcessPackage);

// handle messages from extension to webview
window.addEventListener('message', event => {
    const message = event.data; // The json data that the extension sent
    switch (message.command) {
        case 'completePackage':
            // remove first item
            spackages.options[0] = null;

            processPackages();
            break;
    }
});

function processInput(inputArray, targetDiv, targetId, isLast) {
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
        if (isLast) {
            tag.selectedIndex = inputArray.length - 1;
        }
    }
}

function enableProcessPackage() {
    var hasNoData = taniumDestServerFqdn?.value.trim().length === 0 || taniumServerUsername?.value.trim().length === 0 || taniumServerPassword.value.trim().length === 0;
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
    processButton.disabled = true;

    const sourceFqdn = taniumSourceServerFqdn === null ? taniumSourceServerFqdnSelect.value : taniumSourceServerFqdn.value;
    const destFqdn = taniumDestServerFqdn === null ? taniumDestServerFqdnSelect.value : taniumDestServerFqdn.value;
    const username = taniumServerUsername === null ? taniumServerUsernameSelect.value : taniumServerUsername.value;
    const signingKey = taniumSigningKey === null ? taniumSigningKeySelect.value : taniumSigningKey.value;

    // process first item
    if (spackages.options.length !== 0) {
        var option = spackages.options[0];

        // send message
        vscode.postMessage({
            command: 'transferPackage',
            sourceFqdn: sourceFqdn,
            destFqdn: destFqdn,
            username: username,
            password: taniumServerPassword.value,
            path: option.value,
            packageName: option.text,
            signingServerLabel: signingKey,
        });
    } else {
        vscode.postMessage({
            command: 'completeProcess'
        });
        processButton.disabled = false;
    }
}