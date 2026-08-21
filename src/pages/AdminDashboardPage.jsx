
import { Helmet } from 'react-helmet-async';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PaymentVerificationPanel from '@/components/admin/PaymentVerificationPanel';
import IntegrationsPanel from '@/components/admin/IntegrationsPanel';

const AdminDashboard = ({ defaultTab = 'payments' }) => {
  return (
    <>
      <Helmet>
        <title>Admin Dashboard - Management</title>
      </Helmet>
      <div className="px-6 py-12 md:py-24 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-serif mb-2">Admin Dashboard</h1>
          <p className="text-gray-400">Manage bookings, payments, and system configurations.</p>
        </div>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="bg-gray-900 border border-gray-800 mb-8 p-1 rounded-xl">
            <TabsTrigger value="payments" className="rounded-lg data-[state=active]:bg-green-500 data-[state=active]:text-black">
              Payment Verification
            </TabsTrigger>
            <TabsTrigger value="integrations" className="rounded-lg data-[state=active]:bg-green-500 data-[state=active]:text-black">
              Integrations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="payments" className="mt-0">
            <PaymentVerificationPanel />
          </TabsContent>
          <TabsContent value="integrations" className="mt-0">
            <IntegrationsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default AdminDashboard;
