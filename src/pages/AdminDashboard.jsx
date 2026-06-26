
import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PaymentVerificationPanel from '@/components/admin/PaymentVerificationPanel';

const AdminDashboard = () => {
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

        <Tabs defaultValue="payments" className="w-full">
          <TabsList className="bg-gray-900 border border-gray-800 mb-8 p-1 rounded-xl">
            <TabsTrigger value="payments" className="rounded-lg data-[state=active]:bg-green-500 data-[state=active]:text-black">
              Payment Verification
            </TabsTrigger>
            {/* Future admin tabs can go here */}
          </TabsList>
          
          <TabsContent value="payments" className="mt-0">
            <PaymentVerificationPanel />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default AdminDashboard;
