import V2FeaturePage from "@/components/dashboard/V2FeaturePage";
import FriendsPage from "@/app/dashboard/teman/page";
import FriendSharing from "@/components/dashboard/FriendSharing";
import "../misi/mission-learning.css";
export default function Page() { return <V2FeaturePage title="Teman belajar" art={10} guide="friends"><div className="eureka-friends"><header><h1>Belajar lebih seru bersama.</h1><p>Temukan teman, tukar catatan, dan saling bantu memahami materi.</p></header><div className="friends-columns"><FriendsPage /><FriendSharing /></div></div></V2FeaturePage>; }
