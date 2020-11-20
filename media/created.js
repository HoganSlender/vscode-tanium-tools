const vscode = acquireVsCodeApi();

console.log('created');

var createdAddButton = document.getElementById("createdAddButton");
var createdRemoveButton = document.getElementById("createdRemoveButton");
var processCreatedButton = document.getElementById("processCreatedButton");

if (processCreatedButton !== null) {
    console.log(`processCreatedButtons !== null`);
    processCreatedButton.disabled = true;
} else {
    console.log(`processCreatedButtons === null`);
}

var createdlItems = document.getElementById("createdlitems");
var createdrItems = document.getElementById("createdritems");

if (createdlItems !== null) {
    console.log(`createdlItems !== null`);
    createdlItems.addEventListener("dblclick", () => openFile(createdlItems));
} else {
    console.log(`createdlItems === null`);
}

if (createdrItems !== null) {
    console.log(`createdrItems !== null`);
    createdrItems.addEventListener("dblclick", () => openFile(createdrItems));
} else {
    console.log(`createdrItems === null`);
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

if (createdAddButton !== null) {
    console.log(`createdAddButton !== null`);
    createdAddButton.addEventListener("click", () => addButtonEvent(createdlItems, createdrItems));
} else {
    console.log(`createdAddButton === null`);
}

if (createdRemoveButton !== null) {
    console.log(`createdRemoveButton !== null`);
    createdRemoveButton.addEventListener("click", () => removeButtonEvent(createdrItems, createdlItems));
} else {
    console.log(`createdRemoveButton === null`);
}

if (processCreatedButton !== null) {
    console.log(`processCreatedButton !== null`);
    processCreatedButton.addEventListener("click", processCreatedItems);
} else {
    console.log(`processCreatedButton === null`);
}

var divFqdns = document.getElementById("divFqdns");
var divUsernames = document.getElementById("divUsernames");
var divSigningKeys = document.getElementById("divSigningKeys");

if (!showServerInfo) {
    console.log(`showServerInfo === false`);
    serverInfo.style.visibility = 'hidden';
} else {
    console.log(`showServerInfo === true`);
    var divCreatedSourceFqdn = document.getElementById("divCreatedSourceFqdn");
    var divCreatedDestFqdn = document.getElementById("divCreatedDestFqdn");
    var divCreatedUsername = document.getElementById("divCreatedUsername");
    var divCreatedSigningKey = document.getElementById("divCreatedSigningKey");

    var fqdnsText = divFqdns.innerHTML;

    var fqdns = fqdnsText.split(',');
    
    var usernamesText = divUsernames.innerHTML;
    
    var usernames = usernamesText.split(',');
    
    var signingKeysText = divSigningKeys.innerHTML;
    
    var signingKeys = signingKeysText.split(',');
    
    if (divMissingSourceFqdn !== null){
        processInput(fqdns, divCreatedSourceFqdn, 'taniumSourceServerFqdnSelect', false);
    }

    processInput(fqdns, divCreatedDestFqdn, 'taniumDestServerFqdnSelect', true);
    processInput(usernames, divCreatedUsername, 'taniumServerUsernameSelect', true);
    
    if (divCreatedSigningKey !== null) {
        processInput(signingKeys, divCreatedSigningKey, 'taniumSigningKeySelect', true);
    }
    
    var createdTaniumServerPassword = document.getElementById("createdTaniumServerPassword");
    
    var taniumSourceServerFqdnSelect = document.getElementById("taniumSourceServerFqdnSelect");
    var taniumDestServerFqdnSelect = document.getElementById("taniumDestServerFqdnSelect");
    var taniumServerUsernameSelect = document.getElementById("taniumServerUsernameSelect");
    var taniumSigningKeySelect = document.getElementById("taniumSigningKeySelect");
    
    createdTaniumServerPassword.addEventListener("input", enableProcessPackage);
}

// handle messages from extension to webview
window.addEventListener('message', event => {
    const message = event.data; // The json data that the extension sent
    switch (message.command) {
        case 'complete':
            // remove first item
            createdrItems.options[0] = null;

            processCreatedItems();
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
        processModifiedButton.disabled = createdTaniumServerPassword.value.trim().length === 0;
    } else {
        processCreatedButton.disabled = createdrItems.options.length === 0;
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

function processCreatedItems() {
    processCreatedButton.disabled = true;

    const sourceFqdn = taniumSourceServerFqdnSelect?.value ?? '';
    const destFqdn = taniumDestServerFqdnSelect.value;
    const username = taniumServerUsernameSelect.value;
    const signingKey = taniumSigningKeySelect?.value ?? '';

    if (transferIndividual) {
        // process first item
        if (createdrItems.options.length !== 0) {
            var option = createdrItems.options[0];

            // send message
            vscode.postMessage({
                command: 'transferItem',
                sourceFqdn: sourceFqdn,
                destFqdn: destFqdn,
                username: username,
                password: createdTaniumServerPassword.value,
                path: option.value,
                name: option.text,
                signingServerLabel: signingKey,
            });
        } else {
            vscode.postMessage({
                command: 'completeProcess'
            });
            processCreatedButton.disabled = false;
        }
    } else {
        // gather all values and send
        if (createdrItems.options.length !== 0) {
            var items = [];
            for (var i = 0; i < creeatedrItems.options.length; i++) {
                var o = createdrItems.options[i];
                items.push({
                    path: o.value,
                    name: o.text,
                });
            }

            // send message
            vscode.postMessage({
                command: 'transferItems',
                items: items,
            });
            processModifiedButton.disabled = false;
        }
    }
}