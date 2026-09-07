import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CoachAssignmentPanel from '@/components/admin/CoachAssignmentPanel';
import { isCoachAssignmentAvailable } from '@/lib/coachAssignments';
import IntegrationsPanel from '@/components/admin/IntegrationsPanel';
import ClientManagementPanel from '@/components/admin/ClientManagementPanel';

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
          <p className="text-gray-400">Manage clients, coach assignments, and the Bexio accounting integration.</p>
        </div>
          <Tabs defaultValue="clients" className="w-full">
            <TabsList className="bg-gray-900 border border-gray-800 mb-8 p-1 rounded-xl">
              <TabsTrigger value="clients" className="rounded-lg data-[state=active]:bg-green-500 data-[state=active]:text-black">
                Client management
              </TabsTrigger>
              <TabsTrigger value="integrations" className="rounded-lg data-[state=active]:bg-green-500 data-[state=active]:text-black">
                Bexio integration
              </TabsTrigger>
              {coachAssignmentReady && (
                <TabsTrigger value="coach-assignment" className="rounded-lg data-[state=active]:bg-green-500 data-[state=active]:text-black">
                  Coach assignment
                </TabsTrigger>
              )}
            </TabsList>
            
            <TabsContent value="clients" className="mt-0">
              <ClientManagementPanel />
            </TabsContent>
            <TabsContent value="integrations" className="mt-0">
              <IntegrationsPanel />
            </TabsContent>
            {coachAssignmentReady && (
              <TabsContent value="coach-assignment" className="mt-0">
                <CoachAssignmentPanel />
              </TabsContent>
            )}
          </Tabs>
      </div>
    </>
  );
};

export default AdminDashboard;
