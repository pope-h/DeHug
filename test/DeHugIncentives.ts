import {
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("DeHugIncentives", function () {
  async function deployDeHugIncentivesFixture() {
    const [owner, uploader1, uploader2, downloader] = await hre.ethers.getSigners();

    const DeHugIncentives = await hre.ethers.getContractFactory("DeHugIncentives");
    const deHugIncentives = await DeHugIncentives.deploy();

    return { 
      deHugIncentives, 
      owner, 
      uploader1, 
      uploader2, 
      downloader 
    };
  }

  describe("Deployment", function () {
    it("Should deploy with correct owner", async function () {
      const { deHugIncentives, owner } = await loadFixture(deployDeHugIncentivesFixture);
      expect(await deHugIncentives.owner()).to.equal(owner.address);
    });

    it("Should initialize with correct constants", async function () {
      const { deHugIncentives } = await loadFixture(deployDeHugIncentivesFixture);
      
      expect(await deHugIncentives.MODEL_DOWNLOAD_POINTS()).to.equal(10);
      expect(await deHugIncentives.DATASET_DOWNLOAD_POINTS()).to.equal(5);
      expect(await deHugIncentives.QUALITY_BONUS_MULTIPLIER()).to.equal(2);
    });

    it("Should start with empty state", async function () {
      const { deHugIncentives, uploader1 } = await loadFixture(deployDeHugIncentivesFixture);
      
      const userContent = await deHugIncentives.getUserContent(uploader1.address);
      expect(userContent.length).to.equal(0);

      const userStats = await deHugIncentives.getUserStats(uploader1.address);
      expect(userStats.totalPoints).to.equal(0);
      expect(userStats.reputationScore).to.equal(0);
      expect(userStats.isPremiumContributor).to.equal(false);
      expect(userStats.contentCount).to.equal(0);
    });
  });

  describe("Content Upload", function () {
    const sampleContent = {
      contentType: 0, // DATASET
      ipfsHash: "QmTestHash123",
      metadataIPFSHash: "QmMetadataHash123",
      imageIPFSHash: "QmImageHash123",
      title: "Test Dataset",
      description: "A test dataset for ML",
      tags: ["test", "dataset", "ml"]
    };

    it("Should successfully upload content", async function () {
      const { deHugIncentives, uploader1 } = await loadFixture(deployDeHugIncentivesFixture);

      await expect(deHugIncentives.connect(uploader1).uploadContent(
        sampleContent.contentType,
        sampleContent.ipfsHash,
        sampleContent.metadataIPFSHash,
        sampleContent.imageIPFSHash,
        sampleContent.title,
        sampleContent.description,
        sampleContent.tags
      )).to.emit(deHugIncentives, "ContentUploaded")
        .withArgs(1, uploader1.address, sampleContent.contentType, sampleContent.ipfsHash, sampleContent.title);
    });

    it("Should mint NFT with 0 initial balance", async function () {
      const { deHugIncentives, uploader1 } = await loadFixture(deployDeHugIncentivesFixture);

      await deHugIncentives.connect(uploader1).uploadContent(
        sampleContent.contentType,
        sampleContent.ipfsHash,
        sampleContent.metadataIPFSHash,
        sampleContent.imageIPFSHash,
        sampleContent.title,
        sampleContent.description,
        sampleContent.tags
      );

      expect(await deHugIncentives.balanceOf(uploader1.address, 1)).to.equal(0);
    });

    it("Should store content data correctly", async function () {
      const { deHugIncentives, uploader1 } = await loadFixture(deployDeHugIncentivesFixture);

      await deHugIncentives.connect(uploader1).uploadContent(
        sampleContent.contentType,
        sampleContent.ipfsHash,
        sampleContent.metadataIPFSHash,
        sampleContent.imageIPFSHash,
        sampleContent.title,
        sampleContent.description,
        sampleContent.tags
      );

      const content = await deHugIncentives.getContent(1);
      expect(content.uploader).to.equal(uploader1.address);
      expect(content.contentType).to.equal(sampleContent.contentType);
      expect(content.ipfsHash).to.equal(sampleContent.ipfsHash);
      expect(content.title).to.equal(sampleContent.title);
      expect(content.description).to.equal(sampleContent.description);
      expect(content.qualityTier).to.equal(0); // BASIC
      expect(content.downloadCount).to.equal(0);
      expect(content.totalPointsEarned).to.equal(0);
      expect(content.isActive).to.equal(true);
    });

    it("Should update user profile correctly", async function () {
      const { deHugIncentives, uploader1 } = await loadFixture(deployDeHugIncentivesFixture);

      await deHugIncentives.connect(uploader1).uploadContent(
        sampleContent.contentType,
        sampleContent.ipfsHash,
        sampleContent.metadataIPFSHash,
        sampleContent.imageIPFSHash,
        sampleContent.title,
        sampleContent.description,
        sampleContent.tags
      );

      const userContent = await deHugIncentives.getUserContent(uploader1.address);
      expect(userContent.length).to.equal(1);
      expect(userContent[0]).to.equal(1);

      const userStats = await deHugIncentives.getUserStats(uploader1.address);
      expect(userStats.contentCount).to.equal(1);
    });

    it("Should fail with empty IPFS hash", async function () {
      const { deHugIncentives, uploader1 } = await loadFixture(deployDeHugIncentivesFixture);

      await expect(deHugIncentives.connect(uploader1).uploadContent(
        sampleContent.contentType,
        "",
        sampleContent.metadataIPFSHash,
        sampleContent.imageIPFSHash,
        sampleContent.title,
        sampleContent.description,
        sampleContent.tags
      )).to.be.revertedWith("IPFS hash cannot be empty");
    });

    it("Should fail with empty metadata IPFS hash", async function () {
      const { deHugIncentives, uploader1 } = await loadFixture(deployDeHugIncentivesFixture);

      await expect(deHugIncentives.connect(uploader1).uploadContent(
        sampleContent.contentType,
        sampleContent.ipfsHash,
        "",
        sampleContent.imageIPFSHash,
        sampleContent.title,
        sampleContent.description,
        sampleContent.tags
      )).to.be.revertedWith("Metadata IPFS hash cannot be empty");
    });

    it("Should fail with empty title", async function () {
      const { deHugIncentives, uploader1 } = await loadFixture(deployDeHugIncentivesFixture);

      await expect(deHugIncentives.connect(uploader1).uploadContent(
        sampleContent.contentType,
        sampleContent.ipfsHash,
        sampleContent.metadataIPFSHash,
        sampleContent.imageIPFSHash,
        "",
        sampleContent.description,
        sampleContent.tags
      )).to.be.revertedWith("Title cannot be empty");
    });

    it("Should fail with duplicate IPFS hash", async function () {
      const { deHugIncentives, uploader1, uploader2 } = await loadFixture(deployDeHugIncentivesFixture);

      await deHugIncentives.connect(uploader1).uploadContent(
        sampleContent.contentType,
        sampleContent.ipfsHash,
        sampleContent.metadataIPFSHash,
        sampleContent.imageIPFSHash,
        sampleContent.title,
        sampleContent.description,
        sampleContent.tags
      );

      await expect(deHugIncentives.connect(uploader2).uploadContent(
        sampleContent.contentType,
        sampleContent.ipfsHash,
        "QmDifferentMetadata",
        sampleContent.imageIPFSHash,
        "Different Title",
        sampleContent.description,
        sampleContent.tags
      )).to.be.revertedWith("Content already exists");
    });

    it("Should set VERIFIED quality tier for verified uploaders", async function () {
      const { deHugIncentives, owner, uploader1 } = await loadFixture(deployDeHugIncentivesFixture);

      // Add uploader1 as verified
      await deHugIncentives.connect(owner).addVerifiedUploader(uploader1.address);

      await deHugIncentives.connect(uploader1).uploadContent(
        sampleContent.contentType,
        sampleContent.ipfsHash,
        sampleContent.metadataIPFSHash,
        sampleContent.imageIPFSHash,
        sampleContent.title,
        sampleContent.description,
        sampleContent.tags
      );

      const content = await deHugIncentives.getContent(1);
      expect(content.qualityTier).to.equal(2); // VERIFIED
    });
  });

  describe("Download Count Updates", function () {
    async function uploadContentFixture() {
      const fixture = await loadFixture(deployDeHugIncentivesFixture);
      
      await fixture.deHugIncentives.connect(fixture.uploader1).uploadContent(
        0, // DATASET
        "QmTestHash123",
        "QmMetadataHash123",
        "QmImageHash123",
        "Test Dataset",
        "A test dataset for ML",
        ["test", "dataset", "ml"]
      );

      return fixture;
    }

    it("Should update download count and award points", async function () {
      const { deHugIncentives, uploader1 } = await loadFixture(uploadContentFixture);

      await expect(deHugIncentives.connect(uploader1).updateDownloadCount(1, 1))
        .to.emit(deHugIncentives, "ContentDownloaded")
        .withArgs(1, uploader1.address, uploader1.address, 5); // DATASET_DOWNLOAD_POINTS

      const content = await deHugIncentives.getContent(1);
      expect(content.downloadCount).to.equal(1);
      expect(content.totalPointsEarned).to.equal(5);

      expect(await deHugIncentives.balanceOf(uploader1.address, 1)).to.equal(5);
    });

    it("Should award different points for models vs datasets", async function () {
      const { deHugIncentives, uploader1 } = await loadFixture(deployDeHugIncentivesFixture);

      // Upload a model
      await deHugIncentives.connect(uploader1).uploadContent(
        1, // MODEL
        "QmModelHash123",
        "QmMetadataHash123",
        "QmImageHash123",
        "Test Model",
        "A test model",
        ["test", "model"]
      );

      await expect(deHugIncentives.connect(uploader1).updateDownloadCount(1, 1))
        .to.emit(deHugIncentives, "ContentDownloaded")
        .withArgs(1, uploader1.address, uploader1.address, 10); // MODEL_DOWNLOAD_POINTS
    });

    it("Should apply quality tier multipliers", async function () {
      const { deHugIncentives, owner, uploader1 } = await loadFixture(deployDeHugIncentivesFixture);

      // Add uploader1 as verified for VERIFIED tier
      await deHugIncentives.connect(owner).addVerifiedUploader(uploader1.address);

      await deHugIncentives.connect(uploader1).uploadContent(
        0, // DATASET
        "QmTestHash123",
        "QmMetadataHash123",
        "QmImageHash123",
        "Test Dataset",
        "A test dataset for ML",
        ["test", "dataset", "ml"]
      );

      // VERIFIED tier should give 2x points: 5 * 2 = 10
      await expect(deHugIncentives.connect(uploader1).updateDownloadCount(1, 1))
        .to.emit(deHugIncentives, "ContentDownloaded")
        .withArgs(1, uploader1.address, uploader1.address, 10);
    });

    it("Should auto-upgrade quality tier at thresholds", async function () {
      const { deHugIncentives, uploader1 } = await loadFixture(uploadContentFixture);

      // Upgrade to PREMIUM at 100 downloads
      await expect(deHugIncentives.connect(uploader1).updateDownloadCount(1, 100))
        .to.emit(deHugIncentives, "QualityTierUpdated")
        .withArgs(1, 0, 1); // BASIC to PREMIUM

      let content = await deHugIncentives.getContent(1);
      expect(content.qualityTier).to.equal(1); // PREMIUM

      // Upgrade to VERIFIED at 500 total downloads (400 more)
      await expect(deHugIncentives.connect(uploader1).updateDownloadCount(1, 400))
        .to.emit(deHugIncentives, "QualityTierUpdated")
        .withArgs(1, 1, 2); // PREMIUM to VERIFIED

      content = await deHugIncentives.getContent(1);
      expect(content.qualityTier).to.equal(2); // VERIFIED
      expect(content.downloadCount).to.equal(500);
    });

    it("Should update user stats correctly", async function () {
      const { deHugIncentives, uploader1 } = await loadFixture(uploadContentFixture);

      await deHugIncentives.connect(uploader1).updateDownloadCount(1, 1);

      const userStats = await deHugIncentives.getUserStats(uploader1.address);
      expect(userStats.totalPoints).to.equal(5);
      expect(userStats.reputationScore).to.equal(5); // (5/100) + (1*5) = 0 + 5 = 5
    });

    it("Should fail for non-existent token", async function () {
      const { deHugIncentives, uploader1 } = await loadFixture(deployDeHugIncentivesFixture);

      await expect(deHugIncentives.connect(uploader1).updateDownloadCount(999, 1))
        .to.be.revertedWith("Token does not exist");
    });

    it("Should fail for inactive content", async function () {
      const { deHugIncentives, uploader1 } = await loadFixture(uploadContentFixture);

      // Deactivate the content
      await deHugIncentives.connect(uploader1).deactivateContent(1);

      await expect(deHugIncentives.connect(uploader1).updateDownloadCount(1, 1))
        .to.be.revertedWith("Content is not active");
    });

    it("Should fail for non-owner", async function () {
      const { deHugIncentives, uploader2 } = await loadFixture(uploadContentFixture);

      await expect(deHugIncentives.connect(uploader2).updateDownloadCount(1, 1))
        .to.be.revertedWith("Not owner");
    });
  });

  describe("Verified Uploaders Management", function () {
    it("Should allow owner to add verified uploader", async function () {
      const { deHugIncentives, owner, uploader1 } = await loadFixture(deployDeHugIncentivesFixture);

      await deHugIncentives.connect(owner).addVerifiedUploader(uploader1.address);
      expect(await deHugIncentives.verifiedUploaders(uploader1.address)).to.equal(true);
    });

    it("Should allow owner to remove verified uploader", async function () {
      const { deHugIncentives, owner, uploader1 } = await loadFixture(deployDeHugIncentivesFixture);

      await deHugIncentives.connect(owner).addVerifiedUploader(uploader1.address);
      await deHugIncentives.connect(owner).removeVerifiedUploader(uploader1.address);
      expect(await deHugIncentives.verifiedUploaders(uploader1.address)).to.equal(false);
    });

    it("Should fail for non-owner to add verified uploader", async function () {
      const { deHugIncentives, uploader1, uploader2 } = await loadFixture(deployDeHugIncentivesFixture);

      await expect(deHugIncentives.connect(uploader1).addVerifiedUploader(uploader2.address))
        .to.be.revertedWithCustomError(deHugIncentives, "OwnableUnauthorizedAccount");
    });

    it("Should fail for non-owner to remove verified uploader", async function () {
      const { deHugIncentives, uploader1, uploader2 } = await loadFixture(deployDeHugIncentivesFixture);

      await expect(deHugIncentives.connect(uploader1).removeVerifiedUploader(uploader2.address))
        .to.be.revertedWithCustomError(deHugIncentives, "OwnableUnauthorizedAccount");
    });
  });

  describe("Quality Tier Management", function () {
    async function uploadContentFixture() {
      const fixture = await loadFixture(deployDeHugIncentivesFixture);
      
      await fixture.deHugIncentives.connect(fixture.uploader1).uploadContent(
        0, // DATASET
        "QmTestHash123",
        "QmMetadataHash123",
        "QmImageHash123",
        "Test Dataset",
        "A test dataset for ML",
        ["test", "dataset", "ml"]
      );

      return fixture;
    }

    it("Should allow owner to manually update quality tier", async function () {
      const { deHugIncentives, owner } = await loadFixture(uploadContentFixture);

      await expect(deHugIncentives.connect(owner).manualUpdateQualityTier(1, 1))
        .to.emit(deHugIncentives, "QualityTierUpdated")
        .withArgs(1, 0, 1); // BASIC to PREMIUM

      const content = await deHugIncentives.getContent(1);
      expect(content.qualityTier).to.equal(1); // PREMIUM
    });

    it("Should fail for non-owner to manually update quality tier", async function () {
      const { deHugIncentives, uploader1 } = await loadFixture(uploadContentFixture);

      await expect(deHugIncentives.connect(uploader1).manualUpdateQualityTier(1, 1))
        .to.be.revertedWithCustomError(deHugIncentives, "OwnableUnauthorizedAccount");
    });

    it("Should fail for non-existent token", async function () {
      const { deHugIncentives, owner } = await loadFixture(deployDeHugIncentivesFixture);

      await expect(deHugIncentives.connect(owner).manualUpdateQualityTier(999, 1))
        .to.be.revertedWith("Token does not exist");
    });
  });

//   describe("Points Redemption", function () {
//     async function uploadAndDownloadFixture() {
//       const fixture = await loadFixture(deployDeHugIncentivesFixture);
      
//       await fixture.deHugIncentives.connect(fixture.uploader1).uploadContent(
//         0, // DATASET
//         "QmTestHash123",
//         "QmMetadataHash123",
//         "QmImageHash123",
//         "Test Dataset",
//         "A test dataset for ML",
//         ["test", "dataset", "ml"]
//       );

//       // Generate some points
//       await fixture.deHugIncentives.connect(fixture.uploader1).updateDownloadCount(1, 10);

//       return fixture;
//     }

//     it("Should allow uploader to redeem their points", async function () {
//       const { deHugIncentives, uploader1 } = await loadFixture(uploadAndDownloadFixture);

//       const balanceBefore = await deHugIncentives.balanceOf(uploader1.address, 1);
//       expect(balanceBefore).to.equal(50); // 10 downloads * 5 points each

//       await deHugIncentives.connect(uploader1).redeemPoints(1, 20);

//       const balanceAfter = await deHugIncentives.balanceOf(uploader1.address, 1);
//       expect(balanceAfter).to.equal(20);

//       const userStats = await deHugIncentives.getUserStats(uploader1.address);
//       expect(userStats.totalPoints).to.equal(25);
//     });

//     it("Should fail with insufficient points", async function () {
//       const { deHugIncentives, uploader1 } = await loadFixture(uploadAndDownloadFixture);

//       await expect(deHugIncentives.connect(uploader1).redeemPoints(1, 100))
//         .to.be.revertedWith("Insufficient points");
//     });

//     it("Should fail for non-uploader", async function () {
//       const { deHugIncentives, uploader2 } = await loadFixture(uploadAndDownloadFixture);

//       await expect(deHugIncentives.connect(uploader2).redeemPoints(1, 10))
//         .to.be.revertedWith("Not the uploader");
//     });

//     it("Should fail for non-existent token", async function () {
//       const { deHugIncentives, uploader1 } = await loadFixture(deployDeHugIncentivesFixture);

//       await expect(deHugIncentives.connect(uploader1).redeemPoints(999, 10))
//         .to.be.revertedWith("Token does not exist");
//     });
//   });

  describe("Content Deactivation", function () {
    async function uploadContentFixture() {
      const fixture = await loadFixture(deployDeHugIncentivesFixture);
      
      await fixture.deHugIncentives.connect(fixture.uploader1).uploadContent(
        0, // DATASET
        "QmTestHash123",
        "QmMetadataHash123",
        "QmImageHash123",
        "Test Dataset",
        "A test dataset for ML",
        ["test", "dataset", "ml"]
      );

      return fixture;
    }

    it("Should allow uploader to deactivate their content", async function () {
      const { deHugIncentives, uploader1 } = await loadFixture(uploadContentFixture);

      await deHugIncentives.connect(uploader1).deactivateContent(1);

      const content = await deHugIncentives.getContent(1);
      expect(content.isActive).to.equal(false);
    });

    it("Should allow owner to deactivate any content", async function () {
      const { deHugIncentives, owner } = await loadFixture(uploadContentFixture);

      await deHugIncentives.connect(owner).deactivateContent(1);

      const content = await deHugIncentives.getContent(1);
      expect(content.isActive).to.equal(false);
    });

    it("Should fail for unauthorized users", async function () {
      const { deHugIncentives, uploader2 } = await loadFixture(uploadContentFixture);

      await expect(deHugIncentives.connect(uploader2).deactivateContent(1))
        .to.be.revertedWith("Not authorized");
    });

    it("Should fail for non-existent token", async function () {
      const { deHugIncentives, uploader1 } = await loadFixture(deployDeHugIncentivesFixture);

      await expect(deHugIncentives.connect(uploader1).deactivateContent(999))
        .to.be.revertedWith("Token does not exist");
    });
  });

  describe("Reputation System", function () {
    it("Should update reputation score correctly", async function () {
      const { deHugIncentives, uploader1 } = await loadFixture(deployDeHugIncentivesFixture);

      // Upload content (adds 5 to reputation: 1 content * 5)
      await deHugIncentives.connect(uploader1).uploadContent(
        0, // DATASET
        "QmTestHash123",
        "QmMetadataHash123",
        "QmImageHash123",
        "Test Dataset",
        "A test dataset for ML",
        ["test", "dataset", "ml"]
      );

      let userStats = await deHugIncentives.getUserStats(uploader1.address);
      expect(userStats.reputationScore).to.equal(5); // (0/100) + (1*5) = 5

      // Add downloads to get points (100 points / 100 = 1 additional reputation)
      await deHugIncentives.connect(uploader1).updateDownloadCount(1, 20); // 20 * 5 = 100 points

      userStats = await deHugIncentives.getUserStats(uploader1.address);
      expect(userStats.reputationScore).to.equal(6); // (100/100) + (1*5) = 6
    });

    it("Should grant premium contributor status at 1000 reputation", async function () {
      const { deHugIncentives, uploader1 } = await loadFixture(deployDeHugIncentivesFixture);

      // Upload enough content to get high reputation
      for (let i = 0; i < 200; i++) {
        await deHugIncentives.connect(uploader1).uploadContent(
          0, // DATASET
          `QmTestHash${i}`,
          `QmMetadataHash${i}`,
          `QmImageHash${i}`,
          `Test Dataset ${i}`,
          "A test dataset for ML",
          ["test", "dataset", "ml"]
        );
      }

      // Should have reputation of 200 * 5 = 1000, making them premium
      const userStats = await deHugIncentives.getUserStats(uploader1.address);
      expect(userStats.reputationScore).to.equal(1000);
      expect(userStats.isPremiumContributor).to.equal(true);
    });

    it("Should emit reputation updated event", async function () {
      const { deHugIncentives, uploader1 } = await loadFixture(deployDeHugIncentivesFixture);

      await deHugIncentives.connect(uploader1).uploadContent(
        0, // DATASET
        "QmTestHash123",
        "QmMetadataHash123",
        "QmImageHash123",
        "Test Dataset",
        "A test dataset for ML",
        ["test", "dataset", "ml"]
      );

      // This should trigger reputation update
      await expect(deHugIncentives.connect(uploader1).updateDownloadCount(1, 1))
        .to.emit(deHugIncentives, "ReputationUpdated")
        .withArgs(uploader1.address, 5, 5); // Same score since only 5 points earned
    });
  });

  describe("URI Function", function () {
    async function uploadContentFixture() {
      const fixture = await loadFixture(deployDeHugIncentivesFixture);
      
      await fixture.deHugIncentives.connect(fixture.uploader1).uploadContent(
        0, // DATASET
        "QmTestHash123",
        "QmMetadataHash123",
        "QmImageHash123",
        "Test Dataset",
        "A test dataset for ML",
        ["test", "dataset", "ml"]
      );

      return fixture;
    }

    it("Should return correct IPFS URI", async function () {
      const { deHugIncentives } = await loadFixture(uploadContentFixture);

      const uri = await deHugIncentives.uri(1);
      expect(uri).to.equal("ipfs://QmMetadataHash123");
    });

    it("Should fail for non-existent token", async function () {
      const { deHugIncentives } = await loadFixture(deployDeHugIncentivesFixture);

      await expect(deHugIncentives.uri(999))
        .to.be.revertedWith("Token does not exist");
    });
  });

  describe("View Functions", function () {
    async function uploadMultipleContentFixture() {
      const fixture = await loadFixture(deployDeHugIncentivesFixture);
      
      // Upload dataset
      await fixture.deHugIncentives.connect(fixture.uploader1).uploadContent(
        0, // DATASET
        "QmDatasetHash",
        "QmMetadataHash1",
        "QmImageHash1",
        "Test Dataset",
        "A test dataset",
        ["dataset"]
      );

      // Upload model
      await fixture.deHugIncentives.connect(fixture.uploader1).uploadContent(
        1, // MODEL
        "QmModelHash",
        "QmMetadataHash2",
        "QmImageHash2",
        "Test Model",
        "A test model",
        ["model"]
      );

      return fixture;
    }

    it("Should return correct user content", async function () {
      const { deHugIncentives, uploader1 } = await loadFixture(uploadMultipleContentFixture);

      const userContent = await deHugIncentives.getUserContent(uploader1.address);
      expect(userContent.length).to.equal(2);
      expect(userContent[0]).to.equal(1);
      expect(userContent[1]).to.equal(2);
    });

    it("Should return correct user stats", async function () {
      const { deHugIncentives, uploader1 } = await loadFixture(uploadMultipleContentFixture);

      const userStats = await deHugIncentives.getUserStats(uploader1.address);
      expect(userStats.totalPoints).to.equal(0); // No downloads yet
      expect(userStats.reputationScore).to.equal(10); // 2 content * 5 = 10
      expect(userStats.isPremiumContributor).to.equal(false);
      expect(userStats.contentCount).to.equal(2);
    });

    it("Should return correct content details", async function () {
      const { deHugIncentives, uploader1 } = await loadFixture(uploadMultipleContentFixture);

      const content1 = await deHugIncentives.getContent(1);
      expect(content1.uploader).to.equal(uploader1.address);
      expect(content1.contentType).to.equal(0); // DATASET
      expect(content1.ipfsHash).to.equal("QmDatasetHash");
      expect(content1.title).to.equal("Test Dataset");
      
      const content2 = await deHugIncentives.getContent(2);
      expect(content2.uploader).to.equal(uploader1.address);
      expect(content2.contentType).to.equal(1); // MODEL
      expect(content2.ipfsHash).to.equal("QmModelHash");
      expect(content2.title).to.equal("Test Model");
    });

    it("Should fail to get content for non-existent token", async function () {
      const { deHugIncentives } = await loadFixture(deployDeHugIncentivesFixture);

      await expect(deHugIncentives.getContent(999))
        .to.be.revertedWith("Token does not exist");
    });

    it("Should return empty arrays for new users", async function () {
      const { deHugIncentives, uploader2 } = await loadFixture(deployDeHugIncentivesFixture);

      const userContent = await deHugIncentives.getUserContent(uploader2.address);
      expect(userContent.length).to.equal(0);

      const userStats = await deHugIncentives.getUserStats(uploader2.address);
      expect(userStats.totalPoints).to.equal(0);
      expect(userStats.reputationScore).to.equal(0);
      expect(userStats.isPremiumContributor).to.equal(false);
      expect(userStats.contentCount).to.equal(0);
    });
  });

  describe("Edge Cases and Complex Scenarios", function () {
    it("Should handle multiple downloads correctly", async function () {
      const { deHugIncentives, uploader1 } = await loadFixture(deployDeHugIncentivesFixture);

      await deHugIncentives.connect(uploader1).uploadContent(
        0, // DATASET
        "QmTestHash123",
        "QmMetadataHash123",
        "QmImageHash123",
        "Test Dataset",
        "A test dataset for ML",
        ["test", "dataset", "ml"]
      );

      // First download batch
      await deHugIncentives.connect(uploader1).updateDownloadCount(1, 5);
      expect(await deHugIncentives.balanceOf(uploader1.address, 1)).to.equal(25);

      // Second download batch
      await deHugIncentives.connect(uploader1).updateDownloadCount(1, 3);
      expect(await deHugIncentives.balanceOf(uploader1.address, 1)).to.equal(40);

      const content = await deHugIncentives.getContent(1);
      expect(content.downloadCount).to.equal(8);
      expect(content.totalPointsEarned).to.equal(40);
    });

    // it("Should handle quality tier transitions correctly", async function () {
    //   const { deHugIncentives, uploader1 } = await loadFixture(deployDeHugIncentivesFixture);

    //   await deHugIncentives.connect(uploader1).uploadContent(
    //     0, // DATASET
    //     "QmTestHash123",
    //     "QmMetadataHash123",
    //     "QmImageHash123",
    //     "Test Dataset",
    //     "A test dataset for ML",
    //     ["test", "dataset", "ml"]
    //   );

    //   // Start with BASIC tier (5 points per download)
    //   await deHugIncentives.connect(uploader1).updateDownloadCount(1, 100);
    //   expect(await deHugIncentives.balanceOf(uploader1.address, 1)).to.equal(50); // 50 * 5

    //   // Upgrade to PREMIUM tier at 100 downloads (7.5 points per download: 5 * 1.5)
    //   await deHugIncentives.connect(uploader1).updateDownloadCount(1, 50);
    //   expect(await deHugIncentives.balanceOf(uploader1.address, 1)).to.equal(625); // 250 + (50 * 7.5)

    //   let content = await deHugIncentives.getContent(1);
    //   expect(content.qualityTier).to.equal(1); // PREMIUM
    //   expect(content.downloadCount).to.equal(100);

    //   // Upgrade to VERIFIED tier at 500 downloads (10 points per download: 5 * 2)
    //   await deHugIncentives.connect(uploader1).updateDownloadCount(1, 400);
    //   expect(await deHugIncentives.balanceOf(uploader1.address, 1)).to.equal(4625); // 625 + (400 * 10)

    //   content = await deHugIncentives.getContent(1);
    //   expect(content.qualityTier).to.equal(2); // VERIFIED
    //   expect(content.downloadCount).to.equal(500);
    // });

    // it("Should handle large batch operations efficiently", async function () {
    //     const { deHugIncentives, uploader1 } = await loadFixture(deployDeHugIncentivesFixture);

    //     await deHugIncentives.connect(uploader1).uploadContent(
    //         0, // DATASET
    //         "QmTestHash123",
    //         "QmMetadataHash123",
    //         "QmImageHash123",
    //         "Test Dataset",
    //         "A test dataset for ML",
    //         ["test", "dataset", "ml"]
    //     );

    //     // Large batch download update
    //     await deHugIncentives.connect(uploader1).updateDownloadCount(1, 1000);

    //     const content = await deHugIncentives.getContent(1);
    //     expect(content.downloadCount).to.equal(1000);
    //     expect(content.qualityTier).to.equal(2); // VERIFIED (correct expectation)
        
    //     // Points: 100 at BASIC (5 each = 500), 400 at PREMIUM (7.5 each = 3000), 500 at VERIFIED (10 each = 5000) = 8500
    //     expect(await deHugIncentives.balanceOf(uploader1.address, 1)).to.equal(8500);
    // });

    // it("Should maintain accurate token balances across operations", async function () {
    //   const { deHugIncentives, uploader1 } = await loadFixture(deployDeHugIncentivesFixture);

    //   await deHugIncentives.connect(uploader1).uploadContent(
    //     0, // DATASET
    //     "QmTestHash123",
    //     "QmMetadataHash123",
    //     "QmImageHash123",
    //     "Test Dataset",
    //     "A test dataset for ML",
    //     ["test", "dataset", "ml"]
    //   );

    //   // Earn some points
    //   await deHugIncentives.connect(uploader1).updateDownloadCount(1, 10);
    //   expect(await deHugIncentives.balanceOf(uploader1.address, 1)).to.equal(50);

    //   // Redeem half the points
    //   await deHugIncentives.connect(uploader1).redeemPoints(1, 25);
    //   expect(await deHugIncentives.balanceOf(uploader1.address, 1)).to.equal(25);

    //   // Earn more points
    //   await deHugIncentives.connect(uploader1).updateDownloadCount(1, 5);
    //   expect(await deHugIncentives.balanceOf(uploader1.address, 1)).to.equal(50); // 25 + 25

    //   const userStats = await deHugIncentives.getUserStats(uploader1.address);
    //   expect(userStats.totalPoints).to.equal(50); // Total minus redeemed
    // });

    it("Should handle concurrent uploads by different users", async function () {
      const { deHugIncentives, uploader1, uploader2 } = await loadFixture(deployDeHugIncentivesFixture);

      // Both users upload content
      await deHugIncentives.connect(uploader1).uploadContent(
        0, // DATASET
        "QmUser1Hash",
        "QmUser1Metadata",
        "QmUser1Image",
        "User1 Dataset",
        "Dataset by user 1",
        ["user1"]
      );

      await deHugIncentives.connect(uploader2).uploadContent(
        1, // MODEL
        "QmUser2Hash",
        "QmUser2Metadata",
        "QmUser2Image",
        "User2 Model",
        "Model by user 2",
        ["user2"]
      );

      // Verify separate token IDs and content
      const content1 = await deHugIncentives.getContent(1);
      const content2 = await deHugIncentives.getContent(2);

      expect(content1.uploader).to.equal(uploader1.address);
      expect(content1.title).to.equal("User1 Dataset");
      expect(content1.contentType).to.equal(0);

      expect(content2.uploader).to.equal(uploader2.address);
      expect(content2.title).to.equal("User2 Model");
      expect(content2.contentType).to.equal(1);

      // Verify user profiles are separate
      const user1Content = await deHugIncentives.getUserContent(uploader1.address);
      const user2Content = await deHugIncentives.getUserContent(uploader2.address);

      expect(user1Content.length).to.equal(1);
      expect(user1Content[0]).to.equal(1);

      expect(user2Content.length).to.equal(1);
      expect(user2Content[0]).to.equal(2);
    });
  });

  describe("Premium Multiplier Edge Cases", function () {
    it("Should correctly calculate PREMIUM tier points (1.5x)", async function () {
      const { deHugIncentives, owner, uploader1 } = await loadFixture(deployDeHugIncentivesFixture);

      await deHugIncentives.connect(uploader1).uploadContent(
        0, // DATASET (5 base points)
        "QmTestHash123",
        "QmMetadataHash123",
        "QmImageHash123",
        "Test Dataset",
        "A test dataset for ML",
        ["test"]
      );

      // Manually set to PREMIUM tier
      await deHugIncentives.connect(owner).manualUpdateQualityTier(1, 1);

      // PREMIUM: 5 * 1.5 = 7.5, but Solidity truncates to 7
      await deHugIncentives.connect(uploader1).updateDownloadCount(1, 2);
      expect(await deHugIncentives.balanceOf(uploader1.address, 1)).to.equal(14); // 7 * 2
    });

    it("Should handle MODEL points with multipliers", async function () {
      const { deHugIncentives, owner, uploader1 } = await loadFixture(deployDeHugIncentivesFixture);

      await deHugIncentives.connect(uploader1).uploadContent(
        1, // MODEL (10 base points)
        "QmTestHash123",
        "QmMetadataHash123",
        "QmImageHash123",
        "Test Model",
        "A test model",
        ["test"]
      );

      // Manually set to VERIFIED tier
      await deHugIncentives.connect(owner).manualUpdateQualityTier(1, 2);

      // VERIFIED: 10 * 2 = 20 points
      await deHugIncentives.connect(uploader1).updateDownloadCount(1, 3);
      expect(await deHugIncentives.balanceOf(uploader1.address, 1)).to.equal(60); // 20 * 3
    });
  });

  describe("Gas Optimization Tests", function () {
    it("Should efficiently handle batch downloads", async function () {
      const { deHugIncentives, uploader1 } = await loadFixture(deployDeHugIncentivesFixture);

      await deHugIncentives.connect(uploader1).uploadContent(
        0, // DATASET
        "QmTestHash123",
        "QmMetadataHash123",
        "QmImageHash123",
        "Test Dataset",
        "A test dataset for ML",
        ["test"]
      );

      // Single large update should be more efficient than multiple small ones
      const tx = await deHugIncentives.connect(uploader1).updateDownloadCount(1, 50);
      const receipt = await tx.wait();
      
      // This is mainly to ensure the transaction succeeds with reasonable gas
      expect(receipt?.status).to.equal(1);
      
      const content = await deHugIncentives.getContent(1);
      expect(content.downloadCount).to.equal(50);
    });
  });

  describe("Integration Tests", function () {
    // it("Should handle complete user journey", async function () {
    //   const { deHugIncentives, owner, uploader1 } = await loadFixture(deployDeHugIncentivesFixture);

    //   // 1. User uploads content
    //   await deHugIncentives.connect(uploader1).uploadContent(
    //     0, // DATASET
    //     "QmTestHash123",
    //     "QmMetadataHash123",
    //     "QmImageHash123",
    //     "Test Dataset",
    //     "A comprehensive ML dataset",
    //     ["machine-learning", "dataset", "test"]
    //   );

    //   // 2. Content gets downloaded (simulate organic growth)
    //   await deHugIncentives.connect(uploader1).updateDownloadCount(1, 10);
      
    //   let userStats = await deHugIncentives.getUserStats(uploader1.address);
    //   expect(userStats.totalPoints).to.equal(50);
    //   expect(userStats.reputationScore).to.equal(5); // (50/100) + (1*5) = 0 + 5

    //   // 3. Content becomes popular, reaches PREMIUM tier
    //   await deHugIncentives.connect(uploader1).updateDownloadCount(1, 90); // Total 100
      
    //   let content = await deHugIncentives.getContent(1);
    //   expect(content.qualityTier).to.equal(1); // PREMIUM
    //   expect(content.downloadCount).to.equal(100);

    //   // 4. User becomes verified
    //   await deHugIncentives.connect(owner).addVerifiedUploader(uploader1.address);

    //   // 5. User uploads another piece of content (now as verified)
    //   await deHugIncentives.connect(uploader1).uploadContent(
    //     1, // MODEL
    //     "QmModelHash456",
    //     "QmModelMetadata456",
    //     "QmModelImage456",
    //     "Test Model",
    //     "A powerful ML model",
    //     ["model", "ai"]
    //   );

    //   const newContent = await deHugIncentives.getContent(2);
    //   expect(newContent.qualityTier).to.equal(2); // VERIFIED (due to verified uploader)

    //   // 6. New content gets downloads with VERIFIED multiplier
    //   await deHugIncentives.connect(uploader1).updateDownloadCount(2, 5);
    //   expect(await deHugIncentives.balanceOf(uploader1.address, 2)).to.equal(100); // 5 downloads * 10 base points * 2 multiplier

    //   // 7. User redeems some points
    //   await deHugIncentives.connect(uploader1).redeemPoints(1, 100);

    //   // 8. Verify final state
    //   userStats = await deHugIncentives.getUserStats(uploader1.address);
    //   expect(userStats.contentCount).to.equal(2);
    //   expect(userStats.isPremiumContributor).to.equal(false); // Would need 1000+ reputation

    //   const userContent = await deHugIncentives.getUserContent(uploader1.address);
    //   expect(userContent.length).to.equal(2);
    //   expect(userContent[0]).to.equal(1);
    //   expect(userContent[1]).to.equal(2);
    // });

    it("Should maintain data consistency across all operations", async function () {
      const { deHugIncentives, owner, uploader1, uploader2 } = await loadFixture(deployDeHugIncentivesFixture);

      // Create a complex scenario with multiple users and content
      const scenarios = [
        { user: uploader1, type: 0, hash: "QmDataset1", title: "Dataset 1" },
        { user: uploader1, type: 1, hash: "QmModel1", title: "Model 1" },
        { user: uploader2, type: 0, hash: "QmDataset2", title: "Dataset 2" },
      ];

      // Upload all content
      for (let i = 0; i < scenarios.length; i++) {
        const scenario = scenarios[i];
        await deHugIncentives.connect(scenario.user).uploadContent(
          scenario.type,
          scenario.hash,
          `QmMetadata${i+1}`,
          `QmImage${i+1}`,
          scenario.title,
          `Description for ${scenario.title}`,
          ["test"]
        );
      }

      // Verify IPFS hash mappings
      expect(await deHugIncentives.ipfsHashToTokenId("QmDataset1")).to.equal(1);
      expect(await deHugIncentives.ipfsHashToTokenId("QmModel1")).to.equal(2);
      expect(await deHugIncentives.ipfsHashToTokenId("QmDataset2")).to.equal(3);

      // Add some verified status changes
      await deHugIncentives.connect(owner).addVerifiedUploader(uploader1.address);

      // Simulate downloads and verify point calculations
      await deHugIncentives.connect(uploader1).updateDownloadCount(1, 10); // Dataset: 10 * 5 = 50 points
      await deHugIncentives.connect(uploader1).updateDownloadCount(2, 5);  // Model: 5 * 10 = 50 points
      await deHugIncentives.connect(uploader2).updateDownloadCount(3, 8);  // Dataset: 8 * 5 = 40 points

      // Verify user stats consistency
      const user1Stats = await deHugIncentives.getUserStats(uploader1.address);
      const user2Stats = await deHugIncentives.getUserStats(uploader2.address);

      expect(user1Stats.totalPoints).to.equal(100);
      expect(user1Stats.contentCount).to.equal(2);
      expect(user1Stats.reputationScore).to.equal(11); // (100/100) + (2*5) = 1 + 10

      expect(user2Stats.totalPoints).to.equal(40);
      expect(user2Stats.contentCount).to.equal(1);
      expect(user2Stats.reputationScore).to.equal(5); // (40/100) + (1*5) = 0 + 5

      // Verify token balances
      expect(await deHugIncentives.balanceOf(uploader1.address, 1)).to.equal(50);
      expect(await deHugIncentives.balanceOf(uploader1.address, 2)).to.equal(50);
      expect(await deHugIncentives.balanceOf(uploader2.address, 3)).to.equal(40);
    });
  });
});