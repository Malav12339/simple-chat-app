interface InputBoxProps {
  text: string,
  inputRef?: React.RefObject<HTMLInputElement | null>,
  handleKeyPress?: (e: React.KeyboardEvent) => void
}

function InputBox({ text, inputRef, handleKeyPress } : InputBoxProps) {
  return (
    <input placeholder={text} 
      className={`border border-slate-200 dark:border-stone-800 shadow-md p-2 rounded-md w-full`}
      ref={inputRef}
      onKeyDown={handleKeyPress}
    />
  )
}

export default InputBox