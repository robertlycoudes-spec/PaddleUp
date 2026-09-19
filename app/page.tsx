import { getChatGPTUser } from "./chatgpt-auth";
import PaddleUpApp from "./PaddleUpApp";

export default async function Home() {
  const user = await getChatGPTUser();
  return <PaddleUpApp initialUser={user} />;
}
