"use client";

import { useSearchParams } from "next/navigation";
import ChatInterface from "@/components/ChatInterface";

export default function ChatPageClient() {
  const searchParams = useSearchParams();
  const initialPrompt = searchParams.get("prompt") ?? undefined;

  return (
    <div className="h-screen w-full relative -mt-24 -mx-4 lg:-mx-margin-safe"> 
      {/* We use negative horizontal margins to break out of the layout's main padding,
          allowing the Chat interface to be full screen horizontally (excluding sidebar). */}
      <ChatInterface initialPrompt={initialPrompt} />
    </div>
  );
}
