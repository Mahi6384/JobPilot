import React from "react";
import { User, Phone, MapPin } from "lucide-react";
import Input from "../ui/Input";

function BasicInfoStep({ formData, setFormData, errors }) {
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="space-y-5">
      <Input
        id="fullName"
        name="fullName"
        type="text"
        label="Full Name"
        placeholder="Enter your full name"
        icon={User}
        value={formData.fullName || ""}
        onChange={handleChange}
        error={errors?.fullName}
      />

      <Input
        id="phone"
        name="phone"
        type="tel"
        label="Phone Number"
        placeholder="Enter your phone number"
        icon={Phone}
        value={formData.phone || ""}
        onChange={handleChange}
        error={errors?.phone}
      />

      <Input
        id="location"
        name="location"
        type="text"
        label="Current City"
        placeholder="e.g., Bangalore, Mumbai"
        icon={MapPin}
        value={formData.location || ""}
        onChange={handleChange}
        error={errors?.location}
      />
    </div>
  );
}

export default BasicInfoStep;
