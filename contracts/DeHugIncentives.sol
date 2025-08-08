// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract DeHugIncentives is ERC1155, Ownable, ReentrancyGuard {
    uint256 private _tokenIdCounter;
    
    uint256 public constant MODEL_DOWNLOAD_POINTS = 10;
    uint256 public constant DATASET_DOWNLOAD_POINTS = 5;
    uint256 public constant QUALITY_BONUS_MULTIPLIER = 2;
    
    enum ContentType { DATASET, MODEL }
    enum QualityTier { BASIC, PREMIUM, VERIFIED }
    
    struct Content {
        address uploader;
        ContentType contentType;
        string ipfsHash;
        string metadataIPFSHash;
        string title;
        string description;
        QualityTier qualityTier;
        uint256 downloadCount;
        uint256 totalPointsEarned;
        uint256 uploadTimestamp;
        bool isActive;
        string[] tags;
        string imageIPFSHash;
    }
    
    struct UserProfile {
        uint256[] uploadedContent;
        uint256 totalPoints;
        uint256 reputationScore;
        bool isPremiumContributor;
        mapping(uint256 => uint256) tokenBalances;
    }
    
    mapping(uint256 => Content) public contents;
    mapping(address => UserProfile) public userProfiles;
    mapping(string => uint256) public ipfsHashToTokenId;
    mapping(address => bool) public verifiedUploaders;
    
    event ContentUploaded(uint256 indexed tokenId, address indexed uploader, ContentType contentType, string ipfsHash, string title);
    event BatchDownloadsUpdated(uint256 indexed tokenId, uint256 additionalDownloads, uint256 pointsAwarded);
    event ContentDownloaded(uint256 indexed tokenId, address indexed downloader, address indexed uploader, uint256 pointsAwarded);
    event QualityTierUpdated(uint256 indexed tokenId, QualityTier oldTier, QualityTier newTier);
    event ReputationUpdated(address indexed user, uint256 oldScore, uint256 newScore);
    
    constructor() ERC1155("") Ownable(msg.sender) {
        _tokenIdCounter = 0;
    }
    
    function uploadContent(
        ContentType _contentType,
        string memory _ipfsHash,
        string memory _metadataIPFSHash,
        string memory _imageIPFSHash,
        string memory _title,
        string memory _description,
        string[] memory _tags
    ) external returns (uint256) {
        require(bytes(_ipfsHash).length > 0, "IPFS hash cannot be empty");
        require(bytes(_metadataIPFSHash).length > 0, "Metadata IPFS hash cannot be empty");
        require(bytes(_title).length > 0, "Title cannot be empty");
        require(ipfsHashToTokenId[_ipfsHash] == 0, "Content already exists");
        
        _tokenIdCounter++;
        uint256 newTokenId = _tokenIdCounter;
        
        QualityTier qualityTier = verifiedUploaders[msg.sender] ? QualityTier.VERIFIED : QualityTier.BASIC;
        
        contents[newTokenId] = Content({
            uploader: msg.sender,
            contentType: _contentType,
            ipfsHash: _ipfsHash,
            metadataIPFSHash: _metadataIPFSHash,
            title: _title,
            description: _description,
            qualityTier: qualityTier,
            downloadCount: 0,
            totalPointsEarned: 0,
            uploadTimestamp: block.timestamp,
            isActive: true,
            tags: _tags,
            imageIPFSHash: _imageIPFSHash
        });
        
        ipfsHashToTokenId[_ipfsHash] = newTokenId;
        userProfiles[msg.sender].uploadedContent.push(newTokenId);
        
        _mint(msg.sender, newTokenId, 0, "");
        
        // Update reputation score for content upload
        _updateReputationScore(msg.sender);
        
        emit ContentUploaded(newTokenId, msg.sender, _contentType, _ipfsHash, _title);
        
        return newTokenId;
    }
    
    function updateDownloadCount(uint256 _tokenId, uint256 _downloadCount) external {
        require(_exists(_tokenId), "Token does not exist");
        require(contents[_tokenId].isActive, "Content is not active");
        require(msg.sender == contents[_tokenId].uploader, "Not owner");
        
        Content storage content = contents[_tokenId];
        address uploader = content.uploader;
        
        uint256 basePoints = content.contentType == ContentType.MODEL 
            ? MODEL_DOWNLOAD_POINTS 
            : DATASET_DOWNLOAD_POINTS;
            
        uint256 pointsToAward = basePoints;
        
        if (content.qualityTier == QualityTier.PREMIUM) {
            pointsToAward = (pointsToAward * 3) / 2; // 1.5x THIS WOULD BE CHECKED AS IT WILL ROUND DOWN THE VALUES
        } else if (content.qualityTier == QualityTier.VERIFIED) {
            pointsToAward = pointsToAward * QUALITY_BONUS_MULTIPLIER; // 2x
        }
        
        // Scale points by download count
        pointsToAward = pointsToAward * _downloadCount;
        
        content.downloadCount += _downloadCount;
        content.totalPointsEarned += pointsToAward;
        _autoUpdateQualityTier(_tokenId);
        
        _mint(uploader, _tokenId, pointsToAward, "");
        
        userProfiles[uploader].totalPoints += pointsToAward;
        userProfiles[uploader].tokenBalances[_tokenId] += pointsToAward;
        
        _updateReputationScore(uploader);
        
        emit ContentDownloaded(_tokenId, msg.sender, uploader, pointsToAward);
        emit BatchDownloadsUpdated(_tokenId, _downloadCount, pointsToAward);
    }
    
    function _autoUpdateQualityTier(uint256 _tokenId) internal {
        Content storage content = contents[_tokenId];
        QualityTier oldTier = content.qualityTier;
        
        if (content.downloadCount >= 500 && content.qualityTier < QualityTier.VERIFIED) {
            content.qualityTier = QualityTier.VERIFIED;
            emit QualityTierUpdated(_tokenId, oldTier, QualityTier.VERIFIED);
        } else if (content.downloadCount >= 100 && content.qualityTier < QualityTier.PREMIUM) {
            content.qualityTier = QualityTier.PREMIUM;
            emit QualityTierUpdated(_tokenId, oldTier, QualityTier.PREMIUM);
        }
    }
    
    function manualUpdateQualityTier(uint256 _tokenId, QualityTier _newTier) external onlyOwner {
        require(_exists(_tokenId), "Token does not exist");
        QualityTier oldTier = contents[_tokenId].qualityTier;
        contents[_tokenId].qualityTier = _newTier;
        emit QualityTierUpdated(_tokenId, oldTier, _newTier);
    }
    
    function addVerifiedUploader(address _uploader) external onlyOwner {
        verifiedUploaders[_uploader] = true;
    }
    
    function removeVerifiedUploader(address _uploader) external onlyOwner {
        verifiedUploaders[_uploader] = false;
    }
    
    function getContent(uint256 _tokenId) external view returns (
        address uploader,
        ContentType contentType,
        string memory ipfsHash,
        string memory title,
        string memory description,
        QualityTier qualityTier,
        uint256 downloadCount,
        uint256 totalPointsEarned,
        uint256 uploadTimestamp,
        bool isActive
    ) {
        require(_exists(_tokenId), "Token does not exist");
        Content memory content = contents[_tokenId];
        return (
            content.uploader,
            content.contentType,
            content.ipfsHash,
            content.title,
            content.description,
            content.qualityTier,
            content.downloadCount,
            content.totalPointsEarned,
            content.uploadTimestamp,
            content.isActive
        );
    }
    
    function getUserContent(address _user) external view returns (uint256[] memory) {
        return userProfiles[_user].uploadedContent;
    }
    
    function getUserStats(address _user) external view returns (
        uint256 totalPoints,
        uint256 reputationScore,
        bool isPremiumContributor,
        uint256 contentCount
    ) {
        UserProfile storage profile = userProfiles[_user];
        return (
            profile.totalPoints,
            profile.reputationScore,
            profile.isPremiumContributor,
            profile.uploadedContent.length
        );
    }
    
    function redeemPoints(uint256 _tokenId, uint256 _points) external nonReentrant {
        require(_exists(_tokenId), "Token does not exist");
        require(balanceOf(msg.sender, _tokenId) >= _points, "Insufficient points");
        require(contents[_tokenId].uploader == msg.sender, "Not the uploader");
        
        _burn(msg.sender, _tokenId, _points);
        
        userProfiles[msg.sender].totalPoints -= _points;
        userProfiles[msg.sender].tokenBalances[_tokenId] -= _points;
    }
    
    function deactivateContent(uint256 _tokenId) external {
        require(_exists(_tokenId), "Token does not exist");
        require(contents[_tokenId].uploader == msg.sender || msg.sender == owner(), "Not authorized");
        contents[_tokenId].isActive = false;
    }
    
    function _updateReputationScore(address _user) internal {
        UserProfile storage profile = userProfiles[_user];
        uint256 oldScore = profile.reputationScore;
        uint256 newScore = (profile.totalPoints / 100) + (profile.uploadedContent.length * 5);
        
        profile.reputationScore = newScore;
        
        if (newScore >= 1000 && !profile.isPremiumContributor) {
            profile.isPremiumContributor = true;
        }
        
        if (oldScore != newScore) {
            if (newScore < 1000) {
                profile.isPremiumContributor = false;
            } else if (newScore >= 1000 && !profile.isPremiumContributor) {
                profile.isPremiumContributor = true;
            }  
        }

        emit ReputationUpdated(_user, oldScore, newScore);
    }
    
    function _exists(uint256 _tokenId) internal view returns (bool) {
        return _tokenId > 0 && _tokenId <= _tokenIdCounter;
    }
    
    function uri(uint256 _tokenId) public view override returns (string memory) {
        require(_exists(_tokenId), "Token does not exist");
        return string(abi.encodePacked("ipfs://", contents[_tokenId].metadataIPFSHash));
    }
}