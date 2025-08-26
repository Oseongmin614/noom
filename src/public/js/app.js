const socket = io();
const myFace = document.getElementById("myFace");
const muteBtn =document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const cameraSelect = document.getElementById("cameras");
const call = document.getElementById("call");

let myStream;
let muted = false;
let cameraoff=false;
let roomName;
let nickname;
let myPeerConnection; 
let myDataChannel;

//Welcome Form (join a room)
const welcome = document.getElementById("welcome");
const welcomeForm = welcome.querySelector("form");

async function initCall(){
    welcome.classList.add("hidden");
    call.classList.remove("hidden");
    await getMedia();
    makeConnection();
}

async function handleWelcomeSubmit(event){
    event.preventDefault();
    const roomNameInput = welcomeForm.querySelector("#roomName");
    const nicknameInput = welcomeForm.querySelector("#nickname");
    nickname = nicknameInput.value || "Guest";
    roomName = roomNameInput.value;
    await initCall();
    socket.emit("join_room", roomName, nickname);
    const roomHeader = document.getElementById("roomHeader");
    roomHeader.innerText = `Room: ${roomName}`;
    const myNicknameDiv = document.getElementById("myNickname");
    myNicknameDiv.innerText = nickname;
    roomNameInput.value="";
    nicknameInput.value="";
}
welcomeForm.addEventListener("submit",handleWelcomeSubmit);


socket.on("opponent_nickname", (nick) => {
    const peerNicknameDiv = document.getElementById("peerNickname");
    peerNicknameDiv.innerText = nick;
});

async function getCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter((devices) => devices.kind ==="videoinput");
        const currentCamera = myStream.getVideoTracks()[0];
        cameras.forEach((camera) =>{
            const option = document.createElement("option");
            option.value = camera.deviceId;
            option.innerText = camera.label;
            if(currentCamera.label == camera.label){
                option.selected = true;
            }
            cameraSelect.appendChild(option);
        });
    } catch (error) {
        console.log(error);
    }
}

async function getMedia(deviceId) {
    const initialConstraints ={
        audio: true,
        video: {facingMode:"user"},
    };
    const cameraConstraints={
        audio: true,
        video: {deviceId:{exact:deviceId}}
    };
    try {
        myStream = await navigator.mediaDevices.getUserMedia(
            deviceId ? cameraConstraints: initialConstraints
        );
       myFace.srcObject = myStream;
       if(!deviceId){
       await getCameras();}
    } catch (error) {
        console.log(error);
    }
}



function handleMuteClick(){
    myStream.getAudioTracks().forEach((track) => (track.enabled = !track.enabled));
    const muteIcon = muteBtn.querySelector("i");
    if (myStream.getAudioTracks()[0].enabled) {
        muteIcon.classList.remove("fa-microphone-slash");
        muteIcon.classList.add("fa-microphone");
    } else {
        muteIcon.classList.remove("fa-microphone");
        muteIcon.classList.add("fa-microphone-slash");
    }
}

function handleCameraClick(){
    myStream.getVideoTracks().forEach((track) => (track.enabled = !track.enabled));
    const cameraIcon = cameraBtn.querySelector("i");
    if (myStream.getVideoTracks()[0].enabled) {
        cameraIcon.classList.remove("fa-video-slash");
        cameraIcon.classList.add("fa-video");
    } else {
        cameraIcon.classList.remove("fa-video");
        cameraIcon.classList.add("fa-video-slash");
    }
}

async function handleCameraChange(){
    await getMedia(cameraSelect.value);
    if(myPeerConnection){
        const VideoTrack = myStream.getVideoTracks()[0];
        const videoSender = myPeerConnection
        .getSenders()
        .find((sender)=> sender.track.kind === "video");
        videoSender.replaceTrack(VideoTrack);
    }
}

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click",handleCameraClick);
cameraSelect.addEventListener("input",handleCameraChange);

// Recording
const startRecBtn = document.getElementById("startRec");
const stopRecBtn = document.getElementById("stopRec");
const downloadVideoLink = document.getElementById("downloadVideo");
const downloadAudioLink = document.getElementById("downloadAudio");

let mediaRecorder;
let mediaAudioRecorder;
let recordedVideoChunks = [];
let recordedAudioChunks = [];

function handleStartRecClick() {
    // Reset download links
    downloadVideoLink.classList.add("hidden");
    downloadAudioLink.classList.add("hidden");
    downloadVideoLink.classList.remove("downloaded");
    downloadAudioLink.classList.remove("downloaded");
    downloadVideoLink.querySelector("span").innerText = " Video";
    downloadAudioLink.querySelector("span").innerText = " Audio";

    startRecBtn.classList.add("recording");
    recordedVideoChunks = [];
    recordedAudioChunks = [];

    const videoStream = new MediaStream(myStream.getVideoTracks());
    const audioStream = new MediaStream(myStream.getAudioTracks());

    mediaRecorder = new MediaRecorder(videoStream, { mimeType: "video/webm" });
    mediaAudioRecorder = new MediaRecorder(audioStream, { mimeType: "audio/webm" });

    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedVideoChunks.push(event.data);
        }
    };

    mediaAudioRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedAudioChunks.push(event.data);
        }
    };

    mediaRecorder.onstop = () => {
        const date = new Date();
        const fileName = `${nickname}_${roomName}_${(date.getMonth()+1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}_${date.getHours().toString().padStart(2, '0')}${date.getMinutes().toString().padStart(2, '0')}`;
        const videoBlob = new Blob(recordedVideoChunks, { type: "video/webm" });
        const videoUrl = URL.createObjectURL(videoBlob);
        downloadVideoLink.href = videoUrl;
        downloadVideoLink.download = `${fileName}_video.webm`;
        downloadVideoLink.classList.remove("hidden");
        console.log("Video recording stopped and file is ready for download.");
    };

    mediaAudioRecorder.onstop = () => {
        const date = new Date();
        const fileName = `${nickname}_${roomName}_${(date.getMonth()+1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}_${date.getHours().toString().padStart(2, '0')}${date.getMinutes().toString().padStart(2, '0')}`;
        const audioBlob = new Blob(recordedAudioChunks, { type: "audio/webm" });
        const audioUrl = URL.createObjectURL(audioBlob);
        downloadAudioLink.href = audioUrl;
        downloadAudioLink.download = `${fileName}_audio.webm`;
        downloadAudioLink.classList.remove("hidden");
        console.log("Audio recording stopped and file is ready for download.");
    };

    mediaRecorder.start();
    mediaAudioRecorder.start();

    startRecBtn.disabled = true;
    stopRecBtn.disabled = false;
}

function handleStopRecClick() {
    startRecBtn.classList.remove("recording");
    mediaRecorder.stop();
    mediaAudioRecorder.stop();

    startRecBtn.disabled = false;
    stopRecBtn.disabled = true;
}

startRecBtn.addEventListener("click", handleStartRecClick);
stopRecBtn.addEventListener("click", handleStopRecClick);

downloadVideoLink.addEventListener("click", () => {
    downloadVideoLink.classList.add("downloaded");
    downloadVideoLink.querySelector("span").innerText = " Downloaded!";
});

downloadAudioLink.addEventListener("click", () => {
    downloadAudioLink.classList.add("downloaded");
    downloadAudioLink.querySelector("span").innerText = " Downloaded!";
});


//Socket code

socket.on("welcome", async () => {
    const offer = await myPeerConnection.createOffer();
    myPeerConnection.setLocalDescription(offer);
    console.log("sent the offer");
    socket.emit("offer",offer, roomName);
});

socket.on("offer",async(offer)=>{
    myPeerConnection.setRemoteDescription(offer);
    const answer = await myPeerConnection.createAnswer();
   
    myPeerConnection.setLocalDescription(answer);
    socket.emit("answer",answer,roomName);
})

socket.on("answer",answer=>{
    myPeerConnection.setRemoteDescription(answer);
});

socket.on("ice",ice=>{
    console.log("received candidate");
    myPeerConnection.addIceCandidate(ice);
});

function makeConnection(){
    myPeerConnection = new RTCPeerConnection(
        {
    iceServers:[
        {
            urls:[
                "stun:stun1.l.google.com:19302",
                "stun:stun2.l.google.com:19302",
                "stun:stun3.l.google.com:19302",
                "stun:stun4.l.google.com:19302",
                "stun:stun.l.google.com:19302",
            ]
        }
    ]
}
    );
    myPeerConnection.addEventListener("icecandidate",handleIce);
    myPeerConnection.addEventListener("addstream",handleAddStream);
    myStream.getTracks()
   .forEach(track=>myPeerConnection.addTrack(track,myStream));
}

function handleIce(data){
    console.log("sent candidate");
    socket.emit("ice", data.candidate,roomName);
}

function handleAddStream(data){
   const peerFace = document.getElementById("peerFace");
   peerFace.srcObject = data.stream;
}