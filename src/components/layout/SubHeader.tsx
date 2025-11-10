
interface SubHeaderProps {
  title: string
}

export default function SubHeader({ title }: SubHeaderProps) {
  return (
    <div className="bg-blue-100 text-blue-900 px-6 py-2 shadow-inner flex items-center">
      <h2 className="text-lg font-medium">{title}</h2>
    </div>
  )
}
