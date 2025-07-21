import { useEffect, useRef, useState } from "react"
import Button from "./Button"
import ChatIcon from "./icons/ChatIcon"
import InputBox from "./InputBox"
import CopyIcon from "./icons/CopyIcon"
import { toast } from "sonner"

function Home({socket, isConnected} : {
  socket: WebSocket | null,
  isConnected: boolean
}) {
  type Message = {
    message: string,
    sender: string,
    timestamp: string
  }
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [roomCode, setRoomCode] = useState<string | null>(null) // generated room code to show 
  const [joinedRoomCode, setJoinedRoomCode] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [roomMessages, setRoomMessages] = useState<Message[]>([])
  const [userCount, setUserCount] = useState(1)

  const nameInputRef = useRef<HTMLInputElement>(null)
  const roomCodeInputRef = useRef<HTMLInputElement>(null)
  const messageInputRef = useRef<HTMLInputElement>(null)

  function handleBtnClick() {
    if(!socket) {
      console.error("socket not available", socket)
      toast.error("connection not established yet")
      return;
    }
    if(socket.readyState !== WebSocket.OPEN) {
      console.error("socket is not open, Current state: ", socket.readyState)
      toast.error("connection is not ready. Please wait.")
      return;
    }

    setLoading(true)
    socket.send(JSON.stringify({
      action: "create room"
    }))
  }

  function handleRoomJoin() {
    if(!socket) {
      toast.error("error connecting to server")
      return;
    }
    const nameInput = nameInputRef.current?.value
    const roomCodeInput = roomCodeInputRef.current?.value.toUpperCase()
    console.log("name - ", nameInput, " room code -> ", roomCodeInput)

    if(!nameInput || !roomCodeInput) {
      toast.error("name & room code must provided")
      return;
    }
    setUserName(nameInput)

    socket.send(JSON.stringify({
      action: "join room",
      payload: {
        roomCode: roomCodeInput,
        name: nameInput
      }
    }))

  }
  function handleRoomCodeGeneration(msg: {action: string, roomCode: string}) {
    setRoomCode(msg.roomCode)
    setVisible(true)
    setLoading(false)
    toast.success("Room created successfully!")
  }

  useEffect(() => {
    if(!socket) return;
    const handler = (event: MessageEvent) => {
      let msg;
      try {
        msg = JSON.parse(event.data)
      } catch {
        console.error("Invalid JSON: ", event.data)
        return;
      }

      if(msg.action === 'error') {
        if(roomCodeInputRef.current) {
          roomCodeInputRef.current.value = ""
        }
        toast.error(msg.message)
      }

      if(msg.action === 'success' && msg.description == "added to room" && msg.roomCode) {
        setJoinedRoomCode(msg.roomCode)
        return;
      }

      if(msg.action === 'success' && msg.roomCode) {
        handleRoomCodeGeneration(msg)
        return;
      }

      if(msg.action === 'all messages' && msg.messages) {
        setRoomMessages(messages => [...messages, ...msg.messages])
        setUserCount(msg.userCount)
        setTimeout(() => console.log(roomMessages), 5000)
      }

      if(msg.action === 'message' && msg.data) {
        setRoomMessages(ms => [...ms, msg.data])
      }

      if(msg.action === "user joined" || msg.action === "user left") {
        toast.info(msg.message)
        setUserCount(msg.userCount)
      }
    }
    socket.addEventListener("message", handler)

    return () => socket?.removeEventListener("message", handler)
  }, [isConnected])

  useEffect(() => {
    if(!joinedRoomCode) return;

    socket?.send(JSON.stringify({
      action: "get room messages",
      payload: {
        roomCode: joinedRoomCode
      }
    }))
  }, [joinedRoomCode])

  function sendMessage() {
    if(!messageInputRef.current || messageInputRef.current.value.trim() === "") {
      return;
    }

    socket?.send(JSON.stringify({
      action: "send message",
      payload: {
        roomCode: joinedRoomCode,
        message: messageInputRef.current.value.trim()
      }
    }))

    messageInputRef.current.value = ""
  }
  
  function handleMessageKeyPress(e: React.KeyboardEvent) {
    if(e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const borderStyle = "border border-slate-200 dark:border-stone-800"

  return (
    <div className="h-screen font-mono bg-white dark:bg-black text-black dark:text-white p-4 flex justify-center items-center">
        
      <div className={`space-y-6 rounded-xl p-5 ${borderStyle} shadow-md ${joinedRoomCode ? "h-screen" : visible ? "h-120 md:h-105" : "h-80 md:h-72"} w-full max-w-2xl`}>
          <div className="space-y-1">
          <div className="flex gap-2 text-2xl items-center font-semibold">
            <ChatIcon />  Real Time Chat
          </div>
          <div className="text-gray-500 dark:text-gray-400">
            temporary room that expires after all users exit
          </div>
          </div>
          
          {!joinedRoomCode ? (
          <div className="flex flex-col gap-4">
            <Button text="Create New Room" size="lg" handleBtnClick={handleBtnClick} loading={loading} />
            <InputBox text="Enter your name" inputRef={nameInputRef} />
            <div className="flex gap-2">
              <div className="flex-1 sm:flex-3"><InputBox text="Enter Room Code" inputRef={roomCodeInputRef} /></div>
              <div className="flex-1 sm:flex-1"><Button text="Join Room" size="sm" handleBtnClick={handleRoomJoin} /></div>
            </div>
            {visible && 
            
              
              <div className="flex flex-col justify-center items-center p-6 gap-2 bg-[#F5F5F5] dark:bg-[#262626]">
                {/* show room code  */}
                <div className="text-gray-500 dark:text-gray-400">Share this code with your friend</div>
                <div className="flex gap-4">
                  <div className="text-2xl font-semibold">{roomCode}</div>
                  <button className="cursor-pointer" onClick={() => {
                    if(!roomCode) {
                      return;
                    }
                    navigator.clipboard.writeText(roomCode)
                    toast.success("Room code copied to clipboard!")          
                  }}>
                    <CopyIcon />
                  </button>
                </div>
              </div>
           
            }
            
          </div>
          ): (
            <div className="mt-5 space-y-7 max-w-2xl">
              <div className="flex justify-between rounded-md p-3 bg-lightGray dark:bg-darkGray text-gray-500 dark:text-gray-400">
                <div className="flex gap-3">
                  <div>
                    Room Code: {joinedRoomCode}
                  </div>
                  <button className="cursor-pointer" onClick={() => {
                    if(!roomCode) {
                      return;
                    }
                    navigator.clipboard.writeText(roomCode)
                    toast.success("Room code copied to clipboard!")          
                  }}>
                    <CopyIcon />
                  </button>
                </div>
                <div>Users: {userCount}</div>
              </div>
              <div className={`h-[430px] overflow-y-auto ${borderStyle} rounded-lg p-4`}>
              {roomMessages.map((msg, index) => {
                const prevMsg = roomMessages[index-1]
                const isSameSenderAsPrevious = prevMsg?.sender === msg.sender;
                const shouldShowSender = !isSameSenderAsPrevious;
                return (
                  <div key={index}>
                    {msg.sender === userName ? (
                      <>

                        {/* right */}
                        <div className="flex flex-col items-end">
                          {shouldShowSender && (
                          <div className="text-gray-500 dark:text-gray-400 mb-0.5 text-xs">
                            {/* sender name  */}
                            {msg.sender}
                          </div>)}
                          <div className="inline-block px-3 py-1.5 mt-1.5 break-words rounded-lg bg-black dark:bg-white text-white dark:text-black font-msgFont">
                            {/* message  */}
                            {msg.message}
                          </div>
                        </div>                         
                      </>
                    ) : (
                      <>
                        {/* left */}
                        <div className="flex flex-col items-start">
                          {shouldShowSender && (
                          <div className="text-gray-500 dark:text-gray-400 mb-0.5 text-xs">
                            {/* sender name  */}
                            {msg.sender}
                          </div>)}
                          <div className="inline-block px-3 py-1.5 mt-1.5 bg-muted break-words rounded-lg bg-lightGray dark:bg-darkGray text-black dark:text-white font-msgFont">
                            {/* message  */}
                            {msg.message}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )})}


              </div>
              <div>
                {/* take message input  */}
                <div className="flex gap-2">
                  <div className="flex-5"><InputBox text="Type a message..." inputRef={messageInputRef} handleKeyPress={handleMessageKeyPress} /></div>
                  <div className="flex-1"><Button text="Send" size="sm" handleBtnClick={sendMessage} /></div>
                </div>
                
              </div>
            </div>
          )}

      </div>
    </div>
  )
}

export default Home