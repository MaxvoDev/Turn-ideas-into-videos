"use client";
import loadFFmpeg from '@/utils/load-ffmpeg';
import React, { useState } from 'react';

function formatTime(milliseconds: number) {
  const date = new Date(0, 0, 0, 0, 0, 0, milliseconds);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  const ms = date.getMilliseconds().toString().padStart(3, '0');
  return `${hours}:${minutes}:${seconds},${ms}`;
}

function createSubtitles(speechmarks : [any]) {
  let srtContent = '';
  let counter = 1;

  speechmarks.forEach(speechmark => {
    const startTimeFormatted = formatTime(speechmark.startTime);
    const endTimeFormatted = formatTime(speechmark.endTime);
    const captionText = speechmark.value;

    srtContent += `${counter}\n${startTimeFormatted} --> ${endTimeFormatted}\n${captionText}\n\n`;
    counter++;
  });

  return srtContent;
}

export default function GenerateVideo(){
    const [testBlob, setTestBlob] = useState('');
    let audioBlob;
    const API_ENDPOINT = 'https://audio.api.speechify.com/generateAudioFiles';
    const payload = {
        audioFormat: "mp3",
        paragraphChunks: ["Here, we assume that the video file does not contain any audio stream yet, and that you want to have the same output format (here, MP4) as the input format."],
        voiceParams: {
            name: "PVL:1e528bdf-793f-48f7-bb2e-1db739a43754",
            engine: "speechify",
            languageCode: "en-US"
        }
    };
    
    const onSubmitVideo = function(){
        var videoInput = document.getElementById('videoInput') as HTMLInputElement;
        var selectedVideoFile = videoInput.files ? videoInput.files[0] : null;

        var imageInput = document.getElementById('imageInput') as HTMLInputElement;
        var selectedImageFiles = imageInput.files;

        fetch(API_ENDPOINT, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        })
        .then(resp => resp.json())
        .then(async (resp) => {
            const ffmpeg = await loadFFmpeg();
            ffmpeg.on('log', ({ message }) => {
                console.log(message);
            });

            var audioData = resp;
            var speechmarks_data = audioData.speechMarks.chunks[0].chunks;
            var subtitleContent = createSubtitles(speechmarks_data);
            
            if(selectedImageFiles){
                // const videoArrayBuffer = await selectedVideoFile.arrayBuffer();
                // const videoBlob = new Blob([videoArrayBuffer], { type: selectedVideoFile.type });
                // ffmpeg.writeFile('input.mp4', new Uint8Array(await videoBlob.arrayBuffer()));
                
                for(var i=0; i<selectedImageFiles.length; i++){
                    const imageArrayBuffer = await selectedImageFiles[i].arrayBuffer();
                    const imageBlob = new Blob([imageArrayBuffer], { type: "image/png" });
                    ffmpeg.writeFile(`input${i}.png`, new Uint8Array(await imageBlob.arrayBuffer()));
                }

                // Convert base64 audio data to a Blob
                const audioArrayBuffer = Uint8Array.from(atob(audioData.audioStream), c => c.charCodeAt(0));
                audioBlob = new Blob([audioArrayBuffer], { type: 'audio/mpeg' });
                ffmpeg.writeFile('audio.mp3', new Uint8Array(await audioBlob.arrayBuffer()));


                // Convert subtitle content to a Blob (assuming it's plain text, like SRT format)
                const subtitleBlob = new Blob([subtitleContent], { type: 'text/plain' });
                ffmpeg.writeFile('subtitles.srt', new Uint8Array(await subtitleBlob.arrayBuffer()));
            
                // Run FFmpeg command to process the video
                // Run FFmpeg command to process the video
                try {
                    await ffmpeg.exec([
                        '-framerate', '1/2',         // Set the frame rate (1 image every 2 seconds)
                        '-i', 'input%d.png',         // Use the input%d.png pattern to specify input files
                        '-i', 'audio.mp3',           // Replace 'audio.mp3' with the appropriate audio file path
                        '-i', 'subtitles.srt',       // Replace 'subtitles.srt' with the appropriate subtitle file path
                        '-vf', 'subtitles=subtitles.srt:force_style=\'Fontcolor=&H00FF0000\'',
                        'output.mp4'
                    ]);

                    var outputVideo = await ffmpeg.readFile('output.mp4');
                    var outputURL = URL.createObjectURL(new Blob([outputVideo], { type: 'video/mp4' }));
                    setTestBlob(outputURL);
                } 
                catch (error) {
                    console.error('Error executing FFmpeg command:', error);
                }


            }
        })
    }

    return (
        <div>
            <input type="file" id="videoInput" accept="video/*"/>
            <input type="file" id="imageInput" multiple accept="image/*"/>
            <button onClick={onSubmitVideo} id="processButton">Process Video</button>
            {testBlob && (
                <video src={testBlob} controls width="300" height="150"></video>      
            )}
        </div>
    )
}