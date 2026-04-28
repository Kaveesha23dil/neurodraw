const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Handles advanced section-based Whiteboard synchronization.
 */
module.exports = (io, socket, rooms) => {
  
  // Section Management
  socket.on('create-section', (sectionName) => {
    const roomId = socket.roomId;
    if (!roomId || !rooms[roomId]) return;

    const newSection = {
      id: uuidv4(),
      name: sectionName || `Board ${rooms[roomId].sections.length + 1}`,
      strokes: []
    };

    rooms[roomId].sections.push(newSection);
    // Auto-switch everyone to the new section
    rooms[roomId].activeSection = newSection.id;

    io.to(roomId).emit('sections-updated', {
      sections: rooms[roomId].sections,
      activeSection: rooms[roomId].activeSection
    });
  });

  socket.on('switch-section', (sectionId) => {
    const roomId = socket.roomId;
    if (!roomId || !rooms[roomId]) return;

    const sectionExists = rooms[roomId].sections.find(s => s.id === sectionId);
    if (!sectionExists) {
      socket.emit('error', { message: 'Section not found' });
      return;
    }

    rooms[roomId].activeSection = sectionId;
    io.to(roomId).emit('active-section-changed', sectionId);
  });

  socket.on('delete-section', (sectionId) => {
    const roomId = socket.roomId;
    if (!roomId || !rooms[roomId]) return;

    // Prevent deleting the last section
    if (rooms[roomId].sections.length <= 1) {
      socket.emit('error', { message: 'Cannot delete the last remaining board.' });
      return;
    }

    rooms[roomId].sections = rooms[roomId].sections.filter(s => s.id !== sectionId);

    // If the active section was deleted, switch to the first available one
    if (rooms[roomId].activeSection === sectionId) {
      rooms[roomId].activeSection = rooms[roomId].sections[0].id;
    }

    io.to(roomId).emit('sections-updated', {
      sections: rooms[roomId].sections,
      activeSection: rooms[roomId].activeSection
    });
  });

  // Drawing Events
  socket.on('draw', (strokeData) => {
    const roomId = socket.roomId;
    if (!roomId || !rooms[roomId]) return;

    const activeSectionId = rooms[roomId].activeSection;
    const activeSection = rooms[roomId].sections.find(s => s.id === activeSectionId);
    
    if (activeSection) {
      // Save stroke to memory
      activeSection.strokes.push(strokeData);

      // Include username in the broadcasted event
      const strokeWithUser = {
        ...strokeData,
        userId: socket.id,
        username: socket.user.username
      };

      // Broadcast to everyone else
      socket.to(roomId).emit('draw', strokeWithUser);
    }
  });

  socket.on('undo', () => {
    const roomId = socket.roomId;
    if (!roomId || !rooms[roomId]) return;

    const activeSectionId = rooms[roomId].activeSection;
    const activeSection = rooms[roomId].sections.find(s => s.id === activeSectionId);

    if (activeSection && activeSection.strokes.length > 0) {
      // Pop the last stroke
      activeSection.strokes.pop();
      // Broadcast the entire updated strokes array so clients can re-render
      io.to(roomId).emit('canvas-state-sync', activeSection.strokes);
    }
  });

  socket.on('clear-canvas', () => {
    const roomId = socket.roomId;
    if (!roomId || !rooms[roomId]) return;

    const activeSectionId = rooms[roomId].activeSection;
    const activeSection = rooms[roomId].sections.find(s => s.id === activeSectionId);

    if (activeSection) {
      activeSection.strokes = [];
      socket.to(roomId).emit('clear-canvas');
    }
  });

};
