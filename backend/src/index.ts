import dotenv from "dotenv"
dotenv.config()

import { WebSocketServer, WebSocket } from "ws";
import { generateRoomCode } from "./roomGenerator";

const PORT = Number(process.env.PORT) || 5050
console.log("PORT -> ", PORT)
const wss = new WebSocketServer({port: PORT})

// configuration
const ROOM_CLEANUP_TIMEOUT = 2 * 60 * 1000
const MAX_USERS_PER_ROOM = 50
const MAX_MESSAGES_PER_ROOM = 100

interface Room {
    users: {
        socket: WebSocket,
        userName: string
    }[],
    messages: {
        message: string,
        sender: string,
        timestamp: string
    }[],
    timeoutId?: NodeJS.Timeout
}

type IncomingMessage = 
  | {action: "rooms info"}
  | {action: "create room"}
  | {
        action: "join room", 
        payload: {
            roomCode: string,
            name: string
        }
    }
  | {
        action: "send message",
        payload: {
            roomCode: string,
            message: string
        }
    }
  | {
        action: "get room messages",
        payload: {
            roomCode: string
        }
    }
  | {action: string, payload?: any}

const roomMap: Map<string, Room> = new Map()

function sendJson(socket: WebSocket, data: object) {
    socket.send(JSON.stringify(data))
}

function createRoom(socket: WebSocket) {
    let newRoomCode = generateRoomCode(6)
    let attempts = 0
    while(roomMap.has(newRoomCode) && attempts < 100) {
        newRoomCode = generateRoomCode(6)
        attempts++
    }
    
    if(attempts >= 100) {
        return sendJson(socket, {
            action: "error",
            message: "Unable to generate unique room code. Please try again later"
        })
        
    }

    const timeoutId = setTimeout(() => {
        const room = roomMap.get(newRoomCode)
        if(room && room.users.length === 0) {
            roomMap.delete(newRoomCode)
        }
    }, ROOM_CLEANUP_TIMEOUT)

    roomMap.set(newRoomCode, {
        users: [],
        messages: [],
        timeoutId: timeoutId
    })
    sendJson(socket, {
        action: "success",
        roomCode: newRoomCode,
    })
}

// USEFUL WHEN USERS JOIN TO CLEAR EXISTING TIMEOUT WHICH WERE TO DELETE ROOM
function clearRoomTimeout(roomCode: string) {
    const room = roomMap.get(roomCode)
    if(room?.timeoutId) {
        clearTimeout(room.timeoutId)
        room.timeoutId = undefined
        console.log(`timeout cleared for room ${roomCode}`)
    }
}

function deleteRoom(roomCode: string) {
    const room = roomMap.get(roomCode)
    if(room) {
        if(room.timeoutId) clearTimeout(room.timeoutId)
        roomMap.delete(roomCode)
        console.log(`Room ${roomCode} deleted`)
    }
}

function handleUserLeaving(socket: WebSocket) {
    for (const [roomCode, room] of roomMap.entries()) {
        const userIndex = room.users.findIndex(user => user.socket === socket)
        if(userIndex !== -1) {
            const username = room.users[userIndex].userName
            room.users.splice(userIndex, 1)
            if(room.users.length === 0) {
                deleteRoom(roomCode)
            } else {
                // notify all user in the room - this user has left the room
                room.users.forEach(user => {
                    sendJson(user.socket, {
                        action: "user left",
                        message: `${username} has left the room`,
                        userCount: room.users.length
                    })
                })
            }
        }
    }
}

function handleJoinRoom(socket: WebSocket, payload?: {roomCode: string, name: string}) {
    if(!payload) {
        sendJson(socket, {
            action: "error",
            message: "payload required"
        })
        return;                    
    }
    const { roomCode, name } = payload

    if(!roomCode) {
        sendJson(socket, {
            action: "error",
            message: "room code required"
        })
        return;
    }

    const sanitizedName = name?.trim()
    if(!sanitizedName || sanitizedName === "") {
        sendJson(socket, {
            action: "error",
            message: "name required"
        })
        return;
    }

    if(sanitizedName.length > 50) {
        sendJson(socket, {
            action: "error",
            message: "username too long (max 50 characters)"
        })
        return;
    }
    
    const room = roomMap.get(roomCode)
    if(!room) {
        sendJson(socket, {
            action: "error",
            message: "room not found"
        })
        return;                  
    }
    if(room.users.length >= MAX_USERS_PER_ROOM) {
        sendJson(socket, {
            action: "error",
            message: "room is full"
        })
        return;
    }
    let isDuplicate = room.users.some(user => user.userName === payload?.name)

    if(isDuplicate) {
        sendJson(socket, {
            action: "warning",
            message: "username already taken"
        })
        return; 
    }
    clearRoomTimeout(roomCode)
    
    room.users.push({
        userName: payload.name,
        socket: socket
    })

    sendJson(socket, {
        action: "success",
        description: "added to room",
        message: `you are added to room ${roomCode}`,
        roomCode
    })

    room.users.forEach(user => {
        if(user.socket != socket) {
            sendJson(user.socket, {
                action: "user joined",
                message: `${payload?.name} has joined the room`,
                userCount: room.users.length
            })
        }
    })
}

function handleSendMessage(socket: WebSocket, roomCode: string, message: string) {
    // check if user is in this room?
    const room = roomMap.get(roomCode)
    if(!room) {
        sendJson(socket, {
            action: "error",
            message: "room not found"
        })
        return;
    }

    const user = room.users.find(user => user.socket === socket)
    if(!user) {
        sendJson(socket, {
            action: "error",
            message: "Please Join a room to send messages"
        })
        return;
    }

    const sanitizedMessage = message?.trim()
    if(!sanitizedMessage || sanitizedMessage === "") {
        sendJson(socket, {
            action: "error",
            message: "message can not be empty"
        })
        return;
    }
    if(sanitizedMessage.length > 1000) {
        sendJson(socket, {
            action: "error",
            message: "Message too long (max 1000 characters)"
        })
        return;
    }
    const messageData = {
        message: sanitizedMessage,
        sender: user.userName,
        timestamp: new Date().toISOString()
    }

    room.messages.push(messageData)

    // only keep last N messages
    if(room.messages.length > MAX_MESSAGES_PER_ROOM) {
        room.messages = room.messages.slice(-MAX_MESSAGES_PER_ROOM)
    }

    room.users.forEach(user => sendJson(user.socket, {
        action: "message",
        data: messageData
    }))
}

function handleMessage(socket: WebSocket, userMsg: string) {
    let userData: IncomingMessage;
    try {
        userData = JSON.parse(userMsg)
    } catch(e) {
        console.log("error converting to obj: ", e)
        sendJson(socket, {
            action: "error",
            message: "Invalid message format. Expected JSON."
        })          
        return;
    }

    // validate action
    if(!userData.action) {
        sendJson(socket, {
            action: "error",
            message: "Action is Required"
        })
        return;
    }

    switch(userData.action) {
        case "rooms info":
            return sendJson(socket, {
                "action": "success",
                "active rooms": Array.from(roomMap.keys())
            })

        case "create room": 
            return createRoom(socket)
        
        case "join room":
            return handleJoinRoom(socket, userData.payload)

        case "send message": 
            if(!userData.payload) {
                return sendJson(socket, {
                    action: "error",
                    message: "payload required"
                })
            }
            if(!userData.payload.roomCode) {
                return sendJson(socket, {
                    action: "error",
                    message: "room code required"
                })
            }
            return handleSendMessage(socket, userData.payload.roomCode, userData.payload.message)

        case "get room messages":
            if(!userData.payload) {
                return sendJson(socket, {
                    action: "error",
                    message: "payload required"
                })
            }
            if(!userData.payload.roomCode) {
                return sendJson(socket, {
                    action: "error",
                    message: "room code required"
                })
            }
            const roomCode = userData.payload.roomCode
            if(!roomMap.has(roomCode)) {
                return sendJson(socket, {
                    action: "error",
                    message: "room not found"
                })                
            }
            const room = roomMap.get(roomCode)
            const user = room?.users.find(user => user.socket === socket)

            if(!user) {
                return sendJson(socket, {
                    action: "error",
                    description: "room not joined",
                    message: "Please join a room to recieve messages info"
                })
            }
            return sendJson(socket, {
                action: "all messages",
                messages: roomMap.get(roomCode)?.messages,
                userCount: room?.users.length
            })

        default: 
            sendJson(socket, {
                action: "error",
                message: `Unknown action: ${userData.action}`
            })
            break;
    }
}

wss.on("connection", (socket) => {
    socket.on("close", () => {
        handleUserLeaving(socket)
    })

    socket.on("message", (msg) => {
        handleMessage(socket, msg.toString())
    })
})