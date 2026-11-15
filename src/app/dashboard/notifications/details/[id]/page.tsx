import ProviderNotificationsPage from "@/features/provider-notifications/components/ProviderNotificationsPage";

export default async function NotificationDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProviderNotificationsPage key={id} openId={id} />;
}
