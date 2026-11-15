import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CoachAssignmentPanel from '@/components/admin/CoachAssignmentPanel';
import { isCoachAssignmentAvailable } from '@/lib/coachAssignments';
import IntegrationsPanel from '@/components/admin/IntegrationsPanel';
import ClientManagementPanel from '@/components/admin/ClientManagementPanel';
import CampManagementPanel from '@/components/admin/CampManagementPanel';
import MembershipCollectionsPanel from '@/components/admin/MembershipCollectionsPanel';
import { isCollectionDataAvailable } from '@/lib/membershipCollection';
import NewMasthead from './NewMasthead';

const NewAdminPage = () => {
  const [coachAssignmentReady, setCoachAssignmentReady] = useState(false);
  const [collectionsReady, setCollectionsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    isCoachAssignmentAvailable().then((ready) => {
      if (!cancelled) setCoachAssignmentReady(ready);
    });
    isCollectionDataAvailable().then((ready) => {
      if (!cancelled) setCollectionsReady(ready);
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
      <NewMasthead title="Admin" lead="Clients, camps, collections, coach assignment, and the Bexio accounting integration." />
      <section className="nf-page nf-skin">
        <Tabs defaultValue="integrations" className="w-full">
          <TabsList className="nf-filters mb-8">
            <TabsTrigger value="integrations">Bexio integration</TabsTrigger>
            <TabsTrigger value="clients">Client management</TabsTrigger>
            <TabsTrigger value="camps">Camps</TabsTrigger>
            {collectionsReady && <TabsTrigger value="collections">Collections</TabsTrigger>}
            {coachAssignmentReady && <TabsTrigger value="coach-assignment">Coach assignment</TabsTrigger>}
          </TabsList>
          <TabsContent value="integrations"><IntegrationsPanel /></TabsContent>
          <TabsContent value="clients"><ClientManagementPanel /></TabsContent>
          <TabsContent value="camps"><CampManagementPanel /></TabsContent>
          {collectionsReady && <TabsContent value="collections"><MembershipCollectionsPanel /></TabsContent>}
          {coachAssignmentReady && <TabsContent value="coach-assignment"><CoachAssignmentPanel /></TabsContent>}
        </Tabs>
      </section>
    </>
  );
};

export default NewAdminPage;
