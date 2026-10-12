import './MoonImage.css'

export function MoonImage() {
  return (
    <img
      className="ar-moon-image"
      src={`${import.meta.env.BASE_URL}moon-image.png`}
      alt=""
      draggable={false}
    />
  )
}
