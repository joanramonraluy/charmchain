// index.tsx
import { createFileRoute } from "@tanstack/react-router"
import ChatList from "../components/chat/ChatList"

export const Route = createFileRoute("/")(({
  component: () => <ChatList />,
}))