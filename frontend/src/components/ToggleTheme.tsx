import MoonIcon from "./icons/MoonIcon"
import SunIcon from "./icons/SunIcon"

function ToggleTheme({ setIsDark } : { setIsDark: React.Dispatch<React.SetStateAction<boolean>>}) {

  function changeTheme() {
    const html = document.querySelector("html")
    if(html) {
      html.classList.toggle("dark")
      setIsDark(html?.classList.contains("dark"))
    }
  }

  return (
    <button className='fixed top-4 right-4 p-2 rounded-md flex justify-center items-center z-50 cursor-pointer border border-slate-200 dark:border-stone-800 shadow-md' 
    onClick={changeTheme}>
      <SunIcon classDetails="size-4 block dark:hidden" />
      <MoonIcon classDetails="size-4 hidden dark:block dark:text-white" />
    </button>
  )
}

export default ToggleTheme