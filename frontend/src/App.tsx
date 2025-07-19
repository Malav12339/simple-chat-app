import { useEffect, useRef, useState } from "react";
import "./App.css";
import Home from "./components/Home";
import ToggleTheme from "./components/ToggleTheme";
import { toast, Toaster } from "sonner";

function App() {
  const [isDark, setIsDark] = useState(false);
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef<WebSocket | null>(null)

  const reconnectTimerRef = useRef<number | undefined>(undefined)
  const hasShownDisconnectedRef = useRef(false)
  
  // create socket 
  function createSocket() {
    socketRef.current?.close()
    const ws = new WebSocket("ws://localhost:8080")

    ws.addEventListener("open", () => {
      toast.success("connected to server")

      hasShownDisconnectedRef.current = false
      if(reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = undefined
      }
      setIsConnected(true)
    })

    ws.addEventListener("close", () => {
      if(!hasShownDisconnectedRef.current) {
        toast.error("Connection lost. Trying to reconnect...")
        hasShownDisconnectedRef.current = true
      }
      setIsConnected(false)
      startReconnection()
    })

    ws.addEventListener("error", () => {
      setIsConnected(false)
      // close the errored socket to trigger close event
      ws.close()
    })

    socketRef.current = ws
  }

  function startReconnection() {
    if(reconnectTimerRef.current) return;
    let delay = 1 * 1000
    const maxDelay = 30 * 1000
    
    const attempt = () => {
      createSocket()
      reconnectTimerRef.current = window.setTimeout(() => {
        delay = Math.min(delay * 2, maxDelay)
        attempt()
      }, Math.min(delay, maxDelay))
    }
    attempt()
  }

  useEffect(() => {
    createSocket()

    return () => {
      if(reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = undefined
      }
      socketRef.current?.close()

    }
  }, [])
  return (
    <div>
      <Toaster theme={isDark ? "dark" : "light"} />
      <ToggleTheme setIsDark={setIsDark} />
      <Home socket={socketRef.current} isConnected={isConnected} />
    </div>
  );
}

export default App;
