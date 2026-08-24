import { Helmet } from 'react-helmet-async';
import IntegrationsPanel from '@/components/admin/IntegrationsPanel';

const AdminDashboard = () => {
  return (
    <>
      <Helmet>
        <title>Admin Dashboard - Management</title>
      </Helmet>
      <div className="px-6 py-12 md:py-24 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-serif mb-2">Admin Dashboard</h1>
          <p className="text-gray-400">Manage the Bexio accounting integration and payment reconciliation.</p>
        </div>
        <IntegrationsPanel />
      </div>
    </>
  );
};

export default AdminDashboard;
