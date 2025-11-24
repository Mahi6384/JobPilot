const mongoose = require("mongoose");
const crypto = require("crypto");

const naukriSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    cookiesEncrypted: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Encrypt cookies before saving
naukriSessionSchema.pre("save", function (next) {
  if (this.isModified("cookiesEncrypted")) {
    const algorithm = "aes-256-cbc";
    const key = Buffer.from(process.env.ENCRYPTION_KEY || "your-32-char-secret-key-here!!", "utf8");
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(this.cookiesEncrypted, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    this.cookiesEncrypted = iv.toString("hex") + ":" + encrypted;
  }
  next();
});

// Decrypt cookies method
naukriSessionSchema.methods.decryptCookies = function () {
  const algorithm = "aes-256-cbc";
  const key = Buffer.from(process.env.ENCRYPTION_KEY || "your-32-char-secret-key-here!!", "utf8");
  const [ivHex, encrypted] = this.cookiesEncrypted.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return JSON.parse(decrypted);
};

const NaukriSession = mongoose.model("NaukriSession", naukriSessionSchema);
module.exports = NaukriSession;
