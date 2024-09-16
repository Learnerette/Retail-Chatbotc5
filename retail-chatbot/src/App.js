import React from 'react';
import ChatBox from './components/ChatBox';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <div className="header-left">C5I</div>
        <div className="header-center">Retail Analytics Chatbot</div>
      </header>
      <ChatBox />
    </div>
  );
}

export default App;
