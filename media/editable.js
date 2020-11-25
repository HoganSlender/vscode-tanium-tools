const vscode = acquireVsCodeApi();

var divOpenType = document.getElementById('divOpenType');
var openType = divOpenType.innerHTML;
console.log(`openType: ${openType}`);

var addButton = document.getElementById("addButton");
var removeButton = document.getElementById("removeButton");
var processButton = document.getElementById("processButton");

if (processButton !== null) {
    console.log(`processButtons !== null`);
    processButton.disabled = true;
} else {
    console.log(`processButtons === null`);
}

var lItems = document.getElementById("litems");
var rItems = document.getElementById("ritems");

if (lItems !== null) {
    console.log(`lItems !== null`);
    if (openType === 'file') {
        lItems.addEventListener("dblclick", () => openFile(lItems));
    } else {
        lItems.addEventListener("dblclick", () => openDiff(lItems));
    }
} else {
    console.log(`lItems === null`);
}

if (rItems !== null) {
    console.log(`rItems !== null`);
    if (openType === 'file') {
        rItems.addEventListener("dblclick", () => openFile(rItems));
    } else {
        rItems.addEventListener("dblclick", () => openDiff(rItems));
    }
} else {
    console.log(`rItems === null`);
}

var divShowServerInfo = document.getElementById('divShowServerInfo');

if (divShowServerInfo !== null) {
    console.log(`divShowServerInfo !== null`);    
} else {
    console.log(`divShowServerInfo === null`);    
}

var showServerInfo = divShowServerInfo.innerHTML === '1';
var serverInfo = document.getElementById('serverInfo');

var divTransferIndividual = document.getElementById('divTransferIndividual');
var transferIndividual = divTransferIndividual.innerHTML === '1';
console.log(`transferIndividual: ${transferIndividual}`);

if (addButton !== null) {
    console.log(`AddButton !== null`);
    addButton.addEventListener("click", () => addButtonEvent(lItems, rItems));
} else {
    console.log(`AddButton === null`);
}

if (removeButton !== null) {
    console.log(`RemoveButton !== null`);
    removeButton.addEventListener("click", () => removeButtonEvent(rItems, lItems));
} else {
    console.log(`RemoveButton === null`);
}

if (processButton !== null) {
    console.log(`processButton !== null`);
    processButton.addEventListener("click", processItems);
} else {
    console.log(`processButton === null`);
}

var divFqdns = document.getElementById("divFqdns");
var divUsernames = document.getElementById("divUsernames");
var divSigningKeys = document.getElementById("divSigningKeys");

if (!showServerInfo) {
    console.log(`showServerInfo === false`);
    serverInfo.style.visibility = 'hidden';
} else {
    console.log(`showServerInfo === true`);
    var divSourceFqdn = document.getElementById("divSourceFqdn");
    var divSourceUsername = document.getElementById("divSourceUsername");

    var divDestFqdn = document.getElementById("divDestFqdn");
    var divDestUsername = document.getElementById("divDestUsername");

    var divSigningKey = document.getElementById("divSigningKey");

    var fqdnsText = divFqdns.innerHTML;

    var fqdns = fqdnsText.split(',');

    var usernamesText = divUsernames.innerHTML;

    var usernames = usernamesText.split(',');

    var signingKeysText = divSigningKeys.innerHTML;

    var signingKeys = signingKeysText.split(',');

    if (divSourceFqdn !== null) {
        processInput(fqdns, divSourceFqdn, 'taniumSourceFqdnSelect', false);
    }

    if (divSourceUsername !== null) {
        processInput(usernames, divSourceUsername, 'taniumSourceUsernameSelect', false);
    }

    processInput(fqdns, divDestFqdn, 'taniumDestFqdnSelect', true);
    processInput(usernames, divDestUsername, 'taniumDestUsernameSelect', true);
    
    if (divSigningKey !== null) {
        processInput(signingKeys, divSigningKey, 'taniumSigningKeySelect', true);
    }

    var sourcePassword = document.getElementById("sourcePassword");
    var destPassword = document.getElementById("destPassword");

    var taniumSourceFqdnSelect = document.getElementById("taniumSourceFqdnSelect");
    var taniumSourceUsernameSelect = document.getElementById("taniumSourceUsernameSelect");
    var taniumDestFqdnSelect = document.getElementById("taniumDestFqdnSelect");
    var taniumDestUsernameSelect = document.getElementById("taniumDestUsernameSelect");
    var taniumSigningKeySelect = document.getElementById("taniumSigningKeySelect");

    sourcePassword.addEventListener("input", enableProcessPackage);
    destPassword.addEventListener("input", enableProcessPackage);
}

// handle messages from extension to webview
window.addEventListener('message', event => {
    const message = event.data; // The json data that the extension sent
    switch (message.command) {
        case 'complete':
            // remove first item
            rItems.options[0] = null;

            processItems();
            break;
    }
});

function processInput(inputArray, targetDiv, targetId, isLast) {
    var tag = document.createElement("select");
    tag.setAttribute("id", `${targetId}`);
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

function enableProcessPackage() {
    if (showServerInfo) {
        processButton.disabled = rItems.options.length === 0 || destPassword.value.trim().length === 0 || sourcePassword.value.trim().length === 0;
    } else {
        processButton.disabled = rItems.options.length === 0;
    }
}

function addButtonEvent(from, to) {
    moveItems(from, to);
    if (!showServerInfo) {
        enableProcessPackage();
    }
}

function removeButtonEvent(from, to) {
    moveItems(from, to);
    if (!showServerInfo) {
        enableProcessPackage();
    }
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

function openDiff(from) {
    console.log('inside openDiff');
    if (from.selectedIndex === -1) {
        return;
    }

    var o = from.options[from.selectedIndex];

    // send message
    vscode.postMessage({
        command: 'openDiff',
        name: o.text,
        path: o.value,
    });
}

function openFile(from) {
    console.log('inside openFile');
    if (from.selectedIndex === -1) {
        return;
    }

    var o = from.options[from.selectedIndex];
    console.log(`filePath: ${o.value}`);

    // send message
    vscode.postMessage({
        command: 'openFile',
        path: o.value,
    });
}

function processItems() {
    console.log('inside processItems');
    processButton.disabled = true;

    const sourceFqdn = taniumSourceFqdnSelect?.value ?? '';
    console.log(`sourceFqdn: ${sourceFqdn}`);
    const sourceUsername = taniumSourceUsernameSelect?.value ?? '';
    console.log(`sourceUsername: ${sourceUsername}`);
    const destFqdn = taniumDestFqdnSelect?.value ?? '';
    console.log(`destFqdn: ${destFqdn}`);
    const destUsername = taniumDestUsernameSelect?.value ?? '';
    console.log(`destUsername: ${destUsername}`);
    const signingKey = taniumSigningKeySelect?.value ?? '';
    console.log(`signingKey: ${signingKey}`);

    if (transferIndividual) {
        console.log('transfer individual');
        // process first item
        if (rItems.options.length !== 0) {
            var option = rItems.options[0];

            // send message
            vscode.postMessage({
                command: 'transferItem',
                sourceFqdn: sourceFqdn,
                sourceUsername: sourceUsername,
                sourcePassword: sourcePassword.value,
                destFqdn: destFqdn,
                destUsername: destUsername,
                destPassword: destPassword.value,
                path: option.value,
                name: option.text,
                signingServerLabel: signingKey,
            });
        } else {
            vscode.postMessage({
                command: 'completeProcess'
            });
            processButton.disabled = false;
        }
    } else {
        console.log('transfer all');
        // gather all values and send
        if (rItems.options.length !== 0) {
            var items = [];
            for (var i = 0; i < rItems.options.length; i++) {
                var o = rItems.options[i];
                items.push({
                    path: o.value,
                    name: o.text,
                });
            }

            console.log(`items: ${JSON.stringify(items, null, 2)}`);

            // send message
            vscode.postMessage({
                command: 'transferItems',
                items: items,
            });
            processButton.disabled = false;
        }
    }
}