export function generateRoomCode(limit: number) {
    let options: string = "QWERTYUIOPASDFGHJKLZXCVBNM1234567890"
    let ans: string = ""
    
    for(let i = 0; i < limit; i++) {
        ans += options[Math.floor(Math.random() * options.length)]
    }

    return ans
}