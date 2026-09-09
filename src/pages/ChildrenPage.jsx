import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import ChildAvatar from '@/components/children/ChildAvatar';
import ChildForm from '@/components/children/ChildForm';
import RemoveChildModal from '@/components/modals/RemoveChildModal';
import { createChild, listChildren, removeChild, uploadChildAvatar } from '@/lib/children';

const ChildrenPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('return_to');
  const safeReturnTo = returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : null;

  const [children, setChildren] = useState([]);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  const refresh = async () => {
    const rows = await listChildren();
    setChildren(rows);
  };

  useEffect(() => {
    if (!user) return;
    refresh().catch((error) => toast({ title: 'Could not load children', description: error.message, variant: 'destructive' }));
  }, [user]);

  const handleCreate = async (values, avatarFile) => {
    setSaving(true);
    try {
      const created = await createChild(values, user.id);
      if (avatarFile) {
        try {
          await uploadChildAvatar(created.id, user.id, avatarFile);
        } catch (error) {
          toast({ title: 'Child saved, image failed', description: error.message, variant: 'destructive' });
        }
      }
      toast({ title: 'Child saved' });
      if (safeReturnTo) {
        navigate(`${safeReturnTo}?select_child=${created.id}`);
        return;
      }
      await refresh();
    } catch (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    setRemoveBusy(true);
    try {
      await removeChild(removing.id);
      toast({ title: 'Child removed' });
      setRemoving(null);
      await refresh();
    } catch (error) {
      toast({ title: 'Cannot remove child', description: error.message, variant: 'destructive' });
    } finally {
      setRemoveBusy(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>My Children - AGC Padel Academy</title>
      </Helmet>
      <div className="px-6 py-12 md:py-24 max-w-5xl mx-auto w-full">
        <h1 className="text-3xl font-bold font-serif mb-8 text-center">My Children</h1>

        <Card className="bg-gray-900 border-gray-800 max-w-xl mx-auto mb-10">
          <CardHeader>
            <CardTitle className="text-center">Add a child</CardTitle>
          </CardHeader>
          <CardContent>
            {safeReturnTo && (
              <p className="text-sm text-gray-400 text-center mb-4">
                Save the child and we will take you straight back to the registration.
              </p>
            )}
            <ChildForm mode="create" submitting={saving} onSubmit={handleCreate} />
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {children.map((child) => (
            <Card key={child.id} className="bg-gray-900 border-gray-800">
              <CardContent className="flex items-center gap-4 p-4">
                <button
                  type="button"
                  onClick={() => navigate(`/children/${child.id}`)}
                  className="flex items-center gap-4 flex-1 text-left rounded-lg"
                >
                  <ChildAvatar child={child} />
                  <div>
                    <p className="font-semibold">{child.first_name} {child.last_name}</p>
                    <p className="text-sm text-gray-400">
                      {child.date_of_birth || 'No date of birth'} · {child.padel_level || 'No level set'}
                    </p>
                  </div>
                </button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-gray-700"
                    onClick={() => navigate(`/children/${child.id}`)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-300"
                    onClick={() => setRemoving(child)}
                  >
                    Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {children.length === 0 && (
            <p className="text-gray-500 text-sm">No children yet. Add your first child above.</p>
          )}
        </div>
      </div>

      <RemoveChildModal
        open={Boolean(removing)}
        child={removing}
        loading={removeBusy}
        onClose={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />
    </>
  );
};

export default ChildrenPage;
