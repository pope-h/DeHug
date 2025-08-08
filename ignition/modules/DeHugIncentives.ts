import hre, { ethers } from "hardhat";

async function main(): Promise<void> {
    try {
        console.log(" Starting deployment process...\n");

        const [deployer] = await ethers.getSigners();
        console.log(" Deploying with account:", deployer.address);
        console.log("Network:", hre.network.name);

        // Deploy the contract
        console.log("\n Deploying DeHugIncentives contract...");
        const DeHugIncentives = await ethers.getContractFactory("DeHugIncentives");
        const deHugIncentives = await DeHugIncentives.deploy();
        await deHugIncentives.waitForDeployment();

        const deHugIncentivesAddress: string = await deHugIncentives.getAddress();
        console.log("\n Contract deployed successfully!");
        console.log(" Contract address:", deHugIncentivesAddress);

        // Wait for a few blocks before verification
        console.log("\n Waiting for 5 blocks before verification...");
        await new Promise<void>(resolve => setTimeout(resolve, 30000));

        // Verify the contract
        console.log("\n Verifying contract on block explorer...");
        try {
            await hre.run("verify:verify", {
                address: deHugIncentivesAddress,
                constructorArguments: []
            });
            console.log(" Contract verified successfully!");
        } catch (error: any) {
            console.error(" Contract verification failed:", error.message);
            console.log("\n Manual Verification Info:");
            console.log("Contract Address:", deHugIncentivesAddress);
            console.log("Solidity Version: 0.8.20");
            console.log("Optimizer: Enabled with 200 runs");
            console.log("EVM Version: paris");
            console.log("No constructor arguments");
        }

        console.log("\n✨ Deployment process completed!");
    } catch (error: any) {
        console.error("\n Deployment failed:", error.message);
        if (error.stack) {
            console.error("Stack trace:", error.stack);
        }
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });



// npx hardhat run ignition/modules/DeHugIncentives.ts --network calibrationnet

// npx hardhat verify --network calibrationnet 0x97213Ed0955Aa1B4a971cd85BA7cBcf99376ec5b