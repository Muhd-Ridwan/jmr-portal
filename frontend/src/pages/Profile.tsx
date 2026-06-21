import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "../hooks/useAuth";
import { updateProfile, refreshAccessToken } from "../api/auth";
import PageHeader from "../components/PageHeader";
import FormField from "../components/FormField";
import Input from "../components/Input";
import Button from "../components/Button";

export default function Profile() {
  const { user, updateToken } = useAuth();

  const [details, setDetails] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
  });
  const [password, setPassword] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [savingDetails, setSavingDetails] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  async function handleSaveDetails() {
    if (!details.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSavingDetails(true);
    try {
      const result = await updateProfile({
        name: details.name.trim(),
        email: details.email.trim() || undefined,
      });
      const refresh = localStorage.getItem("refresh_token")!;
      const { access_token } = await refreshAccessToken(refresh);
      updateToken(access_token);
      toast.success(result.message);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingDetails(false);
    }
  }

  async function handleSavePassword() {
    if (!password.current_password) {
      toast.error("Enter your current password");
      return;
    }
    if (!password.new_password) {
      toast.error("Enter a new password");
      return;
    }
    if (password.new_password !== password.confirm_password) {
      toast.error("Passwords do not match");
      return;
    }
    setSavingPassword(true);
    try {
      const result = await updateProfile({
        current_password: password.current_password,
        new_password: password.new_password,
      });
      toast.success(result.message);
      setPassword({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 sm:px-8 py-8 space-y-6">
      <PageHeader
        title="Edit Profile"
        description="Update your account details"
        backTo={{ label: "Dashboard", to: "/dashboard" }}
      />

      {/* Details */}
      <div className="bg-surface border border-surface-raised rounded-xl p-6 space-y-4">
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest">
          Account Details
        </h2>
        <FormField label="Name" required>
          <Input
            type="text"
            value={details.name}
            onChange={(e) =>
              setDetails((d) => ({ ...d, name: e.target.value }))
            }
          />
        </FormField>
        <FormField label="Email">
          <Input
            type="email"
            value={details.email}
            onChange={(e) =>
              setDetails((d) => ({ ...d, email: e.target.value }))
            }
          />
        </FormField>
        <div className="flex justify-end pt-1">
          <Button loading={savingDetails} onClick={handleSaveDetails}>
            Save Details
          </Button>
        </div>
      </div>

      {/* Password */}
      <div className="bg-surface border border-surface-raised rounded-xl p-6 space-y-4">
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest">
          Change Password
        </h2>
        <FormField label="Current Password" required>
          <Input
            type="password"
            value={password.current_password}
            onChange={(e) =>
              setPassword((p) => ({ ...p, current_password: e.target.value }))
            }
          />
        </FormField>
        <FormField label="New Password" required>
          <Input
            type="password"
            value={password.new_password}
            onChange={(e) =>
              setPassword((p) => ({ ...p, new_password: e.target.value }))
            }
          />
        </FormField>
        <FormField label="Confirm New Password" required>
          <Input
            type="password"
            value={password.confirm_password}
            onChange={(e) =>
              setPassword((p) => ({ ...p, confirm_password: e.target.value }))
            }
          />
        </FormField>
        <div className="flex justify-end pt-1">
          <Button loading={savingPassword} onClick={handleSavePassword}>
            Change Password
          </Button>
        </div>
      </div>
    </div>
  );
}
