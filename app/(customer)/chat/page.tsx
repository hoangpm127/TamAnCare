import { ChatClient } from "./chat-client";
import { getPublicCatalog } from "@/lib/server/public-catalog";

export const metadata = {
  title: "Chat với cơ sở | Tâm An Center",
};

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const catalog = await getPublicCatalog();
  return <ChatClient branches={catalog.branches} />;
}
