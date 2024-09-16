import React, { useState, useEffect, useRef } from 'react';
import './ChatBox.css';

const ChatBox = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const chatEndRef = useRef(null);

  const handleSend = async () => {
    if (input.trim()) {
      const newMessage = { text: input, sender: 'user' };
      setMessages([...messages, newMessage]);

      // Send request to the backend
      try {
        const response = await fetch('http://localhost:5000/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: input }),
        });

        const data = await response.json();
        setMessages([...messages, newMessage, { text: data.response, sender: 'bot' }]);
      } catch (error) {
        console.error('Error:', error);
        setMessages([...messages, { text: 'Error connecting to the server', sender: 'bot' }]);
      }

      setInput(''); // Clear input field
    }
  };

  // Scroll to bottom of chat history when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="chat-container">
      <div className="chat-box">
        <div className="chat-history">
          {messages.map((msg, idx) => (
            <div key={idx} className={`chat-message ${msg.sender}`}>
              {msg.text}
            </div>
          ))}
          <div ref={chatEndRef} /> {/* Scroll target */}
        </div>
        <div className="chat-input">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
          />
          <button onClick={handleSend}>Send</button>
        </div>
      </div>
    </div>
  );
};

export default ChatBox;
