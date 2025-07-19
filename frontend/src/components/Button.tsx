import { Loader2 } from "lucide-react"

interface ButtonProps {
  size: 'sm' | 'lg',
  text: string,
  handleBtnClick?: () => void,
  loading?: boolean
}

const ButtonSize = {
  sm: "w-full p-2",
  lg: "w-full p-3 text-xl"
}

const loadingStyle = "rounded-lg cursor-pointer bg-[#8b8b8b] dark:bg-[#828282] text-white dark:text-black"
const defaultStyle = "bg-black hover:bg-[#2E2E2E] dark:bg-white dark:hover:bg-[#E2E2E2] text-white dark:text-black rounded-lg cursor-pointer"

function Button({ size, text, handleBtnClick, loading } : ButtonProps) {

  return (
    <button className={`${ButtonSize[size]} ${loading ? loadingStyle : defaultStyle}`}
    onClick={handleBtnClick}>
      {loading ? (
        <div className="flex items-center justify-center">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Creating room...
        </div>
      ) : (
        text
      )}
    </button>
  )
}

export default Button