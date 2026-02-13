const express = require('express');
const router = express.Router();
const sessionManager = require('../sessionManager');

// Helper to get store
const getStore = (deviceId) => sessionManager.getStore(deviceId);
const getSession = (deviceId) => sessionManager.getSession(deviceId);

// GET /api/history/:deviceId/chats
router.get('/:deviceId/chats', async (req, res) => {
    const { deviceId } = req.params;
    const store = getStore(deviceId);
    
    if (!store) {
        return res.status(404).json({ error: 'Store not found or device disconnected' });
    }

    try {
        // chats.all() returns all chats
        const chats = store.chats.all();
        // Sort by recency (conversationTimestamp)
        const sortedChats = chats.sort((a, b) => {
            const timeA = a.conversationTimestamp?.low || a.conversationTimestamp || 0;
            const timeB = b.conversationTimestamp?.low || b.conversationTimestamp || 0;
            return timeB - timeA;
        });
        
        // Enrich with profile name if available in contacts
        const enrichedChats = sortedChats.map(chat => {
            const contact = store.contacts[chat.id] || {};
            return {
                id: chat.id,
                name: contact.name || contact.notify || chat.name || chat.id.split('@')[0],
                unread: chat.unreadCount || 0,
                lastMessage: chat.lastMessageRecvTimestamp,
                timestamp: chat.conversationTimestamp
            };
        });

        res.json({ chats: enrichedChats });
    } catch (err) {
        console.error('[History] Get chats error:', err);
        res.status(500).json({ error: 'Failed to fetch chats' });
    }
});

// GET /api/history/:deviceId/messages/:remoteJid
router.get('/:deviceId/messages/:remoteJid', async (req, res) => {
    const { deviceId, remoteJid } = req.params;
    const { limit = 50 } = req.query;
    const store = getStore(deviceId);

    if (!store) {
        return res.status(404).json({ error: 'Store not found' });
    }

    try {
        // loadMessages(jid, limit)
        const messages = await store.loadMessages(remoteJid, parseInt(limit));
        // Map to simple format
        const result = messages.map(m => ({
            key: m.key,
            message: m.message,
            timestamp: m.messageTimestamp,
            fromMe: m.key.fromMe,
            pushName: m.pushName
        }));
        res.json({ messages: result });
    } catch (err) {
        console.error('[History] Get messages error:', err);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// GET /api/history/:deviceId/contacts/:remoteJid
router.get('/:deviceId/contacts/:remoteJid', async (req, res) => {
    const { deviceId, remoteJid } = req.params;
    const session = getSession(deviceId);
    
    if (!session || !session.sock) {
        return res.status(404).json({ error: 'Device disconnected' });
    }

    try {
        // 1. Get Profile Picture
        let ppUrl = null;
        try {
            ppUrl = await session.sock.profilePictureUrl(remoteJid, 'image');
        } catch (e) {
            // 401 or 404 if no PP
        }

        // 2. Get Status
        let status = null;
        try {
            status = await session.sock.fetchStatus(remoteJid);
        } catch (e) {}

        res.json({
            jid: remoteJid,
            profilePictureUrl: ppUrl,
            status: status?.status || null
        });
    } catch (err) {
        console.error('[History] Get contact error:', err);
        res.status(500).json({ error: 'Failed to fetch contact info' });
    }
});

module.exports = router;
