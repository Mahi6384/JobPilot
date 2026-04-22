import React from "react";
import { Link2, MapPin } from "lucide-react";
import Input from "../ui/Input";

export default function AddressSocialsSection({ formData, setFormData }) {
  const address = formData.address || {};
  const socials = formData.socials || {};

  const setAddress = (patch) =>
    setFormData((prev) => ({
      ...prev,
      address: { ...(prev.address || {}), ...patch },
    }));
  const setSocials = (patch) =>
    setFormData((prev) => ({
      ...prev,
      socials: { ...(prev.socials || {}), ...patch },
    }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">
          Address & Social links
        </h2>
        <p className="text-sm text-gray-400">
          Improves automation on Workday/Lever/Greenhouse.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          id="addressLine1"
          label="Address line 1"
          icon={MapPin}
          value={address.line1 || ""}
          onChange={(e) => setAddress({ line1: e.target.value })}
        />
        <Input
          id="addressLine2"
          label="Address line 2 (optional)"
          icon={MapPin}
          value={address.line2 || ""}
          onChange={(e) => setAddress({ line2: e.target.value })}
        />
        <Input
          id="addressCity"
          label="City"
          icon={MapPin}
          value={address.city || ""}
          onChange={(e) => setAddress({ city: e.target.value })}
        />
        <Input
          id="addressRegion"
          label="State/Region"
          icon={MapPin}
          value={address.region || ""}
          onChange={(e) => setAddress({ region: e.target.value })}
        />
        <Input
          id="addressCountry"
          label="Country"
          icon={MapPin}
          value={address.country || ""}
          onChange={(e) => setAddress({ country: e.target.value })}
        />
        <Input
          id="addressPostal"
          label="Postal / Zip code"
          icon={MapPin}
          value={address.postalCode || ""}
          onChange={(e) => setAddress({ postalCode: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          id="githubUrl"
          label="GitHub URL"
          placeholder="https://github.com/username"
          icon={Link2}
          value={socials.githubUrl || ""}
          onChange={(e) => setSocials({ githubUrl: e.target.value })}
        />
        <Input
          id="portfolioUrl"
          label="Portfolio / Website"
          placeholder="https://your-site.com"
          icon={Link2}
          value={socials.portfolioUrl || ""}
          onChange={(e) => setSocials({ portfolioUrl: e.target.value })}
        />
        <Input
          id="twitterUrl"
          label="Twitter/X (optional)"
          placeholder="https://x.com/username"
          icon={Link2}
          value={socials.twitterUrl || ""}
          onChange={(e) => setSocials({ twitterUrl: e.target.value })}
        />
      </div>
    </div>
  );
}

