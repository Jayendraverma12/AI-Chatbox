  const { useState, useRef, useEffect } = React;
  
  // Main App component
  const App = () => {
      // State for managing chat messages and their metadata (like image/audio URLs)
      const [messages, setMessages] = useState([]);
      // State for the user's input
      const [input, setInput] = useState('');
      // State for tracking the API call loading status
      const [isLoading, setIsLoading] = useState(false);
      // State to track if the app is currently recording voice input
      const [isRecording, setIsRecording] = useState(false);
      // Ref for the chat messages container to enable auto-scrolling
      const messagesEndRef = useRef(null);
  
      // Create a ref for the SpeechRecognition instance
      const recognitionRef = useRef(null);
  
      // Scroll to the bottom of the chat container whenever messages are updated
      useEffect(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, [messages]);
  
      // Cleanup function for the SpeechRecognition instance
      useEffect(() => {
          return () => {
              if (recognitionRef.current) {
                  recognitionRef.current.stop();
              }
          };
      }, []);
  
      // Handle sending a new text message
      const handleSendMessage = async () => {
          if (input.trim() === '') return;
  
          const userMessage = { sender: 'user', text: input };
          setMessages(prevMessages => [...prevMessages, userMessage]);
          setInput('');
          setIsLoading(true);
  
          try {
              // The Gemini API now receives the full conversation history for context
              const history = [...messages, userMessage];
              const aiResponseText = await getAIResponse(history);
              const aiMessage = { sender: 'ai', text: aiResponseText };
              setMessages(prevMessages => [...prevMessages, aiMessage]);
          } catch (error) {
              console.error("Failed to get AI response:", error); // Log the specific error
              const errorMessage = { sender: 'ai', text: 'Sorry, I could not connect to the AI. Please try again.' };
              setMessages(prevMessages => [...prevMessages, errorMessage]);
          } finally {
              setIsLoading(false);
          }
      };
  
      // Function to call the Gemini API for a conversational response
      const getAIResponse = async (history) => {
          const apiKey = "AIzaSyDsGcmAk4L0KsN2KJ15FjEOIOslX6VJ1E8";
          const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
  
          // Format the conversation history for the API payload
          const contents = history.map(msg => ({
              role: msg.sender === 'user' ? 'user' : 'model',
              parts: [{ text: msg.text }],
          }));
  
          const payload = {
              contents: contents,
          };
  
          try {
              const response = await fetch(apiUrl, {
                  method: 'POST',
                  headers: {
                      'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(payload),
              });
  
              if (!response.ok) {
                  const errorText = await response.text();
                  throw new Error(`API call failed with status ${response.status}: ${errorText}`);
              }
  
              const result = await response.json();
              const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
              return text || "No response received.";
  
          } catch (error) {
              console.error('Error in getAIResponse:', error);
              throw error;
          }
      };
  
      // Function to call the Gemini API for image generation
      const handleGenerateImage = async () => {
          if (input.trim() === '') return;
  
          const userMessage = { sender: 'user', text: `Generate an image based on the prompt: "${input}"` };
          setMessages(prevMessages => [...prevMessages, userMessage]);
          setInput('');
          setIsLoading(true);
  
          const apiKey = "AIzaSyDsGcmAk4L0KsN2KJ15FjEOIOslX6VJ1E8";
          const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;
  
          const payload = {
              instances: { prompt: input },
              parameters: { sampleCount: 1 }
          };
  
          try {
              const response = await fetch(apiUrl, {
                  method: 'POST',
                  headers: {
                      'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(payload)
              });
  
              if (!response.ok) {
                  const errorText = await response.text();
                  throw new Error(`Image API call failed with status ${response.status}: ${errorText}`);
              }
  
              const result = await response.json();
              const base64Data = result?.predictions?.[0]?.bytesBase64Encoded;
  
              if (base64Data) {
                  const imageUrl = `data:image/png;base64,${base64Data}`;
                  const aiImageMessage = { sender: 'ai', text: 'Here is your image:', imageUrl: imageUrl };
                  setMessages(prevMessages => [...prevMessages, aiImageMessage]);
              } else {
                  const errorMessage = { sender: 'ai', text: 'Image generation failed. Please try a different prompt.' };
                  setMessages(prevMessages => [...prevMessages, errorMessage]);
              }
          } catch (error) {
              console.error('Error generating image:', error);
              const errorMessage = { sender: 'ai', text: 'Sorry, I could not generate the image. Please try again.' };
              setMessages(prevMessages => [...prevMessages, errorMessage]);
          } finally {
              setIsLoading(false);
          }
      };
  
      // Function to call the Gemini API for Text-to-Speech
      const handleGenerateAudio = async (text, messageIndex) => {
          const apiKey = "AIzaSyDsGcmAk4L0KsN2KJ15FjEOIOslX6VJ1E8";
          const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;
  
          const payload = {
              contents: [{
                  parts: [{ text: text }]
              }],
              generationConfig: {
                  responseModalities: ["AUDIO"],
                  speechConfig: {
                      voiceConfig: {
                          prebuiltVoiceConfig: { voiceName: "Puck" }
                      }
                  }
              },
          };
  
          try {
              const response = await fetch(apiUrl, {
                  method: 'POST',
                  headers: {
                      'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(payload)
              });
  
              if (!response.ok) {
                  const errorText = await response.text();
                  console.error('Audio API call failed:', response.status, errorText);
                  // Display a user-friendly error message in the chat
                  setMessages(prevMessages =>
                      prevMessages.map((msg, index) =>
                          index === messageIndex ? { ...msg, audioError: 'Sorry, I could not generate audio for this message.' } : msg
                      )
                  );
                  return;
              }
  
              const result = await response.json();
              const part = result?.candidates?.[0]?.content?.parts?.[0];
              const audioData = part?.inlineData?.data;
              const mimeType = part?.inlineData?.mimeType;
  
              if (audioData && mimeType && mimeType.startsWith("audio/")) {
                  const pcmData = base64ToArrayBuffer(audioData);
                  const pcm16 = new Int16Array(pcmData);
                  // The API provides the sample rate in the mimeType, e.g., audio/L16;rate=24000
                  const sampleRateMatch = mimeType.match(/rate=(\d+)/);
                  const sampleRate = sampleRateMatch ? parseInt(sampleRateMatch[1], 10) : 24000;
                  
                  const wavBlob = pcmToWav(pcm16, sampleRate);
                  const audioUrl = URL.createObjectURL(wavBlob);
  
                  // Update the message with the new audio URL
                  setMessages(prevMessages =>
                      prevMessages.map((msg, index) =>
                          index === messageIndex ? { ...msg, audioUrl } : msg
                      )
                  );
              }
          } catch (error) {
              console.error('Error generating audio:', error);
              // Display a user-friendly error message in the chat
              setMessages(prevMessages =>
                  prevMessages.map((msg, index) =>
                      index === messageIndex ? { ...msg, audioError: 'Sorry, I could not generate audio for this message. Please try again later.' } : msg
                  )
              );
          }
      };
  
      // Function to handle voice input
      const handleVoiceInput = () => {
          // Check for browser support
          if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
              setMessages(prev => [...prev, { sender: 'ai', text: 'Voice input is not supported in this browser. Please use a modern browser like Chrome or Edge.' }]);
              return;
          }
          
          // Stop recording if it's already in progress
          if (isRecording) {
              recognitionRef.current?.stop();
              return;
          }
  
          const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
          const recognition = new SpeechRecognition();
          recognition.interimResults = false;
          recognition.lang = 'en-US';
          recognitionRef.current = recognition;
  
          recognition.onstart = () => {
              setIsRecording(true);
              setMessages(prev => [...prev, { sender: 'ai', text: 'Listening for your voice...' }]);
          };
  
          recognition.onresult = (event) => {
              const transcript = Array.from(event.results)
                  .map(result => result[0])
                  .map(result => result.transcript)
                  .join('');
              setInput(transcript);
          };
  
          recognition.onend = () => {
              setIsRecording(false);
              if (input.trim() !== '') {
                  handleSendMessage();
              }
          };
  
          recognition.onerror = (event) => {
              console.error('Speech recognition error:', event.error);
              setIsRecording(false);
              setMessages(prev => [...prev, { sender: 'ai', text: 'Sorry, voice input failed. Please try again or type your message.' }]);
          };
  
          recognition.start();
      };
  
      // Helper function to convert base64 to ArrayBuffer
      const base64ToArrayBuffer = (base64) => {
          const binaryString = window.atob(base64);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
          }
          return bytes.buffer;
      };
  
      // Helper function to convert PCM audio data to a WAV Blob
      const pcmToWav = (pcmData, sampleRate) => {
          const numChannels = 1;
          const bitDepth = 16;
          const byteRate = sampleRate * numChannels * (bitDepth / 8);
  
          const buffer = new ArrayBuffer(44 + pcmData.byteLength);
          const view = new DataView(buffer);
  
          // RIFF identifier
          writeString(view, 0, 'RIFF');
          // File size
          view.setUint32(4, 36 + pcmData.byteLength, true);
          // RIFF type
          writeString(view, 8, 'WAVE');
          // format chunk identifier
          writeString(view, 12, 'fmt ');
          // format chunk length
          view.setUint32(16, 16, true);
          // sample format (1 = PCM)
          view.setUint16(20, 1, true);
          // channel count
          view.setUint16(22, numChannels, true);
          // sample rate
          view.setUint32(24, sampleRate, true);
          // byte rate
          view.setUint32(28, byteRate, true);
          // block align
          view.setUint16(32, numChannels * (bitDepth / 8), true);
          // bits per sample
          view.setUint16(34, bitDepth, true);
          // data chunk identifier
          writeString(view, 36, 'data');
          // data chunk length
          view.setUint32(40, pcmData.byteLength, true);
          
          // Write PCM data
          const pcmBytes = new Uint8Array(pcmData.buffer);
          for (let i = 0; i < pcmData.byteLength; i++) {
              view.setUint8(44 + i, pcmBytes[i]);
          }
  
          return new Blob([view], { type: 'audio/wav' });
      };
  
      const writeString = (view, offset, string) => {
          for (let i = 0; i < string.length; i++) {
              view.setUint8(offset + i, string.charCodeAt(i));
          }
      };
  
      // Handle key press for sending messages with 'Enter'
      const handleKeyPress = (e) => {
          if (e.key === 'Enter') {
              handleSendMessage();
          }
      };
  
      return (
          // Main container with a centered, full-screen layout
          <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 font-sans p-4">
              {/* Chatbox container with responsive sizing and a shadow */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg md:max-w-xl lg:max-w-2xl h-[80vh] flex flex-col overflow-hidden transform transition-all duration-300 hover:shadow-2xl">
  
                  {/* Chat header */}
                  <header className="bg-blue-600 text-white p-4 flex items-center justify-between shadow-md rounded-t-2xl">
                      <h1 className="text-xl font-bold tracking-tight">AI Chatbox</h1>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 animate-pulse">
                          <path d="M4.5 3.75a3 3 0 00-3 3v.75h15V6.75a3 3 0 00-3-3h-9z" />
                          <path fillRule="evenodd" d="M16.5 7.5h-15v9a3 3 0 003 3h12a3 3 0 003-3v-9h-3V7.5zM15 12a3 3 0 11-6 0 3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                  </header>
  
                  {/* Chat messages container */}
                  <div className="flex-1 p-4 overflow-y-auto space-y-4">
                      {messages.length === 0 && (
                          <div className="flex items-center justify-center h-full text-center text-gray-400 dark:text-gray-600 text-lg italic animate-fade-in">
                              Start a conversation with the AI...
                          </div>
                      )}
  
                      {messages.map((msg, index) => (
                          <div
                              key={index}
                              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                              <div
                                  className={`max-w-[75%] p-3 rounded-2xl shadow-sm ${
                                      msg.sender === 'user'
                                          ? 'bg-blue-500 text-white rounded-br-none'
                                          : 'bg-gray-200 dark:bg-gray-700 dark:text-gray-200 rounded-bl-none'
                                  }`}
                              >
                                  <p className="whitespace-pre-wrap">{msg.text}</p>
                                  {msg.imageUrl && (
                                      <div className="mt-2 rounded-xl overflow-hidden shadow-lg">
                                          <img src={msg.imageUrl} alt="Generated by AI" className="w-full h-auto" />
                                      </div>
                                  )}
                                  {msg.sender === 'ai' && msg.audioUrl ? (
                                      <div className="mt-2 flex items-center">
                                          <audio controls src={msg.audioUrl} className="w-full"></audio>
                                      </div>
                                  ) : (
                                      msg.sender === 'ai' && msg.audioError ? (
                                          <p className="text-red-500 text-sm mt-2">{msg.audioError}</p>
                                      ) : (
                                          msg.sender === 'ai' && msg.text && (
                                              <button
                                                  onClick={() => handleGenerateAudio(msg.text, index)}
                                                  className="mt-2 p-2 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                                                  title="Listen to this message"
                                              >
                                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                                      <path fillRule="evenodd" d="M9.387 2.629a.75.75 0 00-.737.568L6.251 8.52a4.346 4.346 0 00-.776 1.196 6.817 6.817 0 00-.181 2.306c0 .193.035.378.096.555.129.379.305.718.525 1.021a6.473 6.473 0 001.373 1.293c.38.257.73.516 1.07.828.337.312.636.632.894.975.244.326.417.65.509.914.124.348.199.638.199.782a.75.75 0 01-1.5.064c0-.07-.052-.255-.18-.629a4.472 4.472 0 00-.914-1.353 7.844 7.844 0 00-.994-1.096 7.641 7.641 0 00-1.077-1.124 7.697 7.697 0 00-1.282-1.087 5.165 5.165 0 01-.621-.65 3.321 3.321 0 01-.334-.417 1.838 1.838 0 01-.282-.361.75.75 0 00-.982-.266l-2.43 1.488a.75.75 0 00.265 1.22l.034.019a.86.86 0 01.1.054c.266.12.56.26.852.42.337.185.66.388.974.606a14.717 14.717 0 001.071.85 10.957 10.957 0 011.602 1.396.75.75 0 001.666-.237c-.12-.395-.316-.79-.607-1.155-.261-.328-.53-.665-.845-1.026-.296-.34-.593-.68-.894-1.04-.32-.38-.64-.77-.96-.98-.32-.21-.68-.38-1.05-.48-.37-.1-.7-.15-1.0-.15-.084 0-.17-.006-.254-.018a.75.75 0 00-.737.568l-2.185 7.11a.75.75 0 00.941.926 60.598 60.598 0 0018.445-8.986.75.75 0 000-1.218A60.599 60.599 0 003.478 2.405z" clipRule="evenodd" />
                                                  </svg>
                                              </button>
                                          )
                                      )
                                  )}
                              </div>
                          </div>
                      ))}
  
                      {/* Loading indicator for AI response */}
                      {isLoading && (
                          <div className="flex justify-start">
                              <div className="max-w-[75%] p-3 rounded-2xl shadow-sm bg-gray-200 dark:bg-gray-700 dark:text-gray-200 rounded-bl-none">
                                  <div className="flex items-center space-x-2">
                                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"></div>
                                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce delay-150"></div>
                                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce delay-300"></div>
                                  </div>
                              </div>
                          </div>
                      )}
                      {/* Invisible element to scroll to */}
                      <div ref={messagesEndRef} />
                  </div>
  
                  {/* Message input area */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex items-center rounded-b-2xl">
                      <input
                          type="text"
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyPress={handleKeyPress}
                          placeholder="Type your message..."
                          className="flex-1 px-4 py-2 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                          disabled={isLoading || isRecording}
                      />
                      <button
                          onClick={handleVoiceInput}
                          className={`ml-3 p-3 text-white rounded-full shadow-lg transition-all duration-200 transform active:scale-95 disabled:bg-gray-400 disabled:shadow-none ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-purple-600 hover:bg-purple-700'}`}
                          disabled={isLoading}
                          title={isRecording ? 'Stop voice input' : 'Start voice input'}
                      >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                              <path d="M8.25 4.5a.75.75 0 01.75-.75h2.25a.75.75 0 01.75.75v1.5a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75V4.5zm0 9a.75.75 0 01.75-.75h2.25a.75.75 0 01.75.75v1.5a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v-1.5zM3.75 18a.75.75 0 01.75-.75h2.25a.75.75 0 01.75.75v1.5a.75.75 0 01-.75.75H4.5a.75.75 0 01-.75-.75v-1.5zM9 18.75a.75.75 0 01.75-.75h2.25a.75.75 0 01.75.75v1.5a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v-1.5zM15.75 4.5a.75.75 0 01.75-.75h2.25a.75.75 0 01.75.75v1.5a.75.75 0 01-.75.75h-2.25a.75.75 0 01-.75-.75V4.5zM15 11.25a.75.75 0 01.75-.75h2.25a.75.75 0 01.75.75v1.5a.75.75 0 01-.75.75H15.75a.75.75 0 01-.75-.75v-1.5zM.75 9a.75.75 0 01.75-.75h3a.75.75 0 010 1.5h-3a.75.75 0 01-.75-.75zM18 9a.75.75 0 01.75-.75h3a.75.75 0 010 1.5h-3a.75.75 0 01-.75-.75zM.75 15a.75.75 0 01.75-.75h3a.75.75 0 010 1.5h-3a.75.75 0 01-.75-.75zM18 15a.75.75 0 01.75-.75h3a.75.75 0 010 1.5h-3a.75.75 0 01-.75-.75zM6.75 2.25a.75.75 0 01.75-.75h3a.75.75 0 010 1.5h-3a.75.75 0 01-.75-.75zM6.75 21a.75.75 0 01.75-.75h3a.75.75 0 010 1.5h-3a.75.75 0 01-.75-.75zM15.75 2.25a.75.75 0 01.75-.75h3a.75.75 0 010 1.5h-3a.75.75 0 01-.75-.75zM15.75 21a.75.75 0 01.75-.75h3a.75.75 0 010 1.5h-3a.75.75 0 01-.75-.75z" />
                          </svg>
                      </button>
                      <button
                          onClick={handleGenerateImage}
                          className="ml-3 p-3 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-200 transform active:scale-95 disabled:bg-gray-400 disabled:shadow-none"
                          disabled={isLoading || isRecording || input.trim() === ''}
                          title="Generate an image"
                      >
                          <span className="text-xl">✨</span>
                      </button>
                      <button
                          onClick={handleSendMessage}
                          className="ml-3 p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 transform active:scale-95 disabled:bg-gray-400 disabled:shadow-none"
                          disabled={isLoading || isRecording || input.trim() === ''}
                          title="Send message"
                      >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.599 60.599 0 0018.445-8.986.75.75 0 000-1.218A60.599 60.599 0 003.478 2.405z" />
                          </svg>
                      </button>
                  </div>
              </div>
          </div>
      );
  };
  
  // Render the App component into the root element
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(<App />);