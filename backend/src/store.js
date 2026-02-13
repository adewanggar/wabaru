const fs = require('fs');
const path = require('path');

function makeInMemoryStore({ logger }) {
    const chats = new Map();
    const messages = new Map();
    const contacts = new Map();

    const loadMessages = async (jid, count) => {
        const msgs = messages.get(jid) || [];
        // Return latest 'count' messages
        return msgs.slice(-count);
    };

    const bind = (ev) => {
        ev.on('connection.update', (update) => {
            Object.assign(chats, update.chats);
        });

        ev.on('messaging-history.set', ({ chats: newChats, contacts: newContacts, messages: newMessages, isLatest }) => {
            if (newChats) {
                for (const chat of newChats) {
                    const existing = chats.get(chat.id) || {};
                    chats.set(chat.id, { ...existing, ...chat });
                }
            }
            if (newContacts) {
                for (const contact of newContacts) {
                    contacts.set(contact.id, { ...contacts.get(contact.id), ...contact });
                }
            }
            if (newMessages) {
                for (const msg of newMessages) {
                    const jid = msg.key.remoteJid;
                    const list = messages.get(jid) || [];
                    // Avoid duplicates
                    if (!list.find(m => m.key.id === msg.key.id)) {
                        list.push(msg);
                    }
                    messages.set(jid, list);
                }
            }
        });

        ev.on('contacts.upsert', (newContacts) => {
            for (const contact of newContacts) {
                contacts.set(contact.id, { ...contacts.get(contact.id), ...contact });
            }
        });

        ev.on('chats.upsert', (newChats) => {
            for (const chat of newChats) {
                const existing = chats.get(chat.id) || {};
                chats.set(chat.id, { ...existing, ...chat });
            }
        });

        ev.on('messages.upsert', ({ messages: newMessages, type }) => {
            if (type === 'notify' || type === 'append') {
                for (const msg of newMessages) {
                    const jid = msg.key.remoteJid;
                    const list = messages.get(jid) || [];
                    
                    // Check duplicate
                    if (!list.find(m => m.key.id === msg.key.id)) {
                        list.push(msg);
                    }
                    
                    // Update Chat timestamp/last message
                    const chat = chats.get(jid) || { id: jid };
                    chat.conversationTimestamp = msg.messageTimestamp;
                    chat.lastMessageRecvTimestamp = msg.messageTimestamp;
                    chat.unreadCount = (chat.unreadCount || 0) + (msg.key.fromMe ? 0 : 1);
                    chats.set(jid, chat);

                    messages.set(jid, list);
                }
            }
        });
        
        // Handle message updates (status e.g. READ)
         ev.on('messages.update', (updates) => {
            for (const update of updates) {
                const jid = update.key.remoteJid;
                const list = messages.get(jid);
                if (list) {
                    const msgIndex = list.findIndex(m => m.key.id === update.key.id);
                    if (msgIndex > -1) {
                         // Update message object
                         const msg = list[msgIndex];
                         Object.assign(msg, update.update);
                         list[msgIndex] = msg;
                    }
                }
            }
         });
    };

    const toJSON = () => {
        return {
            chats: Object.fromEntries(chats),
            messages: Object.fromEntries(messages),
            contacts: Object.fromEntries(contacts),
        };
    };

    const fromJSON = (json) => {
        if (json.chats) {
             for (const [id, chat] of Object.entries(json.chats)) chats.set(id, chat);
        }
        if (json.messages) {
             for (const [id, msgs] of Object.entries(json.messages)) messages.set(id, msgs);
        }
        if (json.contacts) {
             for (const [id, contact] of Object.entries(json.contacts)) contacts.set(id, contact);
        }
    };

    const writeToFile = (path) => {
        try {
            fs.writeFileSync(path, JSON.stringify(toJSON(), null, 2));
        } catch (err) {
            if (logger) logger.error('Failed to write store:', err);
        }
    };

    const readFromFile = (path) => {
        try {
            if (fs.existsSync(path)) {
                const data = fs.readFileSync(path, 'utf-8');
                fromJSON(JSON.parse(data));
            }
        } catch (err) {
            if (logger) logger.error('Failed to read store:', err);
        }
    };

    return {
        chats: {
            all: () => Array.from(chats.values()),
            get: (id) => chats.get(id),
        },
        contacts: Object.fromEntries(contacts), // Return object for easier access by ID
        messages: {
           get: (id) => messages.get(id) || []
        },
        loadMessages,
        bind,
        writeToFile,
        readFromFile,
    };
}

module.exports = makeInMemoryStore;
