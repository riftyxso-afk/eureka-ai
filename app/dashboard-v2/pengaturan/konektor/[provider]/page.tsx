import ConnectorSettings from "@/components/dashboard/ConnectorSettings";
export default async function ConnectorPage({ params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  return <ConnectorSettings selected={provider} />;
}
