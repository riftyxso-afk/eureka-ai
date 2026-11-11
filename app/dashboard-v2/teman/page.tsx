import V2FeaturePage from "@/components/dashboard/V2FeaturePage";
import FriendsPage from "@/app/dashboard/teman/page";
import FriendSharing from "@/components/dashboard/FriendSharing";
import "../misi/mission-learning.css";
export default function Page() { return <V2FeaturePage title="Teman belajar" art={10} guide="friends"><FriendsPage /><FriendSharing /></V2FeaturePage>; }
