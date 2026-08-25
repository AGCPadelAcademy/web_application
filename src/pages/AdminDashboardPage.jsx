import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PaymentVerificationPanel from '@/components/admin/PaymentVerificationPanel';
import CoachAssignmentPanel from '@/components/admin/CoachAssignmentPanel';
import { isCoachAssignmentAvailable } from '@/lib/coachAssignments';

const AdminDashboard = () => {
  const [coachAssignmentReady, setCoachAssignmentReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    isCoachAssignmentAvailable().then((ready) => {
      if (!cancelled) setCoachAssignmentReady(ready);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

        {coachAssignmentReady ? (
          <Tabs defaultValue="payments" className="w-full">
            <TabsList className="bg-gray-900 border border-gray-800 mb-8 p-1 rounded-xl">
              <TabsTrigger value="payments" className="rounded-lg data-[state=active]:bg-green-500 data-[state=active]:text-black">
                Payment Verification
              </TabsTrigger>
              <TabsTrigger value="coach-assignment" className="rounded-lg data-[state=active]:bg-green-500 data-[state=active]:text-black">
                Coach assignment
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="payments" className="mt-0">
              <PaymentVerificationPanel />
            </TabsContent>
            <TabsContent value="coach-assignment" className="mt-0">
              <CoachAssignmentPanel />
            </TabsContent>
          </Tabs>
        ) : (
          <PaymentVerificationPanel />
        )}
      </div>
    </>
  );
};

export default AdminDashboard;
