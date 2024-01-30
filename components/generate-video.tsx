"use client";
import loadFFmpeg from '@/utils/load-ffmpeg';
import { get } from 'http';
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
    const [testBlobOne, setTestBlobOne] = useState('');
    const [testBlobTwo, setTestBlobTwo] = useState('');
    let audioBlob;
    const API_ENDPOINT = 'https://audio.api.speechify.com/generateAudioFiles';
    const payload = {
        audioFormat: "mp3",
        paragraphChunks: ["Script"],
        voiceParams: {
            name: "PVL:1e528bdf-793f-48f7-bb2e-1db739a43754",
            engine: "speechify",
            languageCode: "en-US"
        }
    };
    
    const sentences = 
    [
        "Here, we assume that the video file does not contain any audio stream yet, and that you want to have the same output format (here, MP4) as the input format",
        "From my point of view."
    ];

    const onSubmitVideo = async function(){
        var videoInput = document.getElementById('videoInput') as HTMLInputElement;
        var selectedVideoFile = videoInput.files ? videoInput.files[0] : null;

        var imageInput = document.getElementById('imageInput') as HTMLInputElement;
        var selectedImageFiles = imageInput.files;
        
        if(!selectedImageFiles)
            return;

        const ffmpeg = await loadFFmpeg();
        ffmpeg.on('log', ({ message }) => {
            console.log(message);
        });

        var getAudioPromises = [];
        var ffmpegcmd: string[] = [];
        for (var i=0; i<sentences.length; i++){
            var tag = i;
            payload.paragraphChunks = [sentences[i]];
            var promise = fetch(API_ENDPOINT, {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            })
            .then(resp => resp.json());
            getAudioPromises.push(promise);
        }

        Promise.all(getAudioPromises)
        .then(async (audioDataResp) => {
            debugger;
            for (var i=0; i<sentences.length; i++){
                var audioData = audioDataResp[i].audioStream;
                // var speechmarks_data = audioData.speechMarks.chunks[0].chunks;
                // var subtitleContent = createSubtitles(speechmarks_data);
                
                // const videoArrayBuffer = await selectedVideoFile.arrayBuffer();
                // const videoBlob = new Blob([videoArrayBuffer], { type: selectedVideoFile.type });
                // ffmpeg.writeFile('input.mp4', new Uint8Array(await videoBlob.arrayBuffer()));
                const imageArrayBuffer = await selectedImageFiles[i].arrayBuffer();
                const imageBlob = new Blob([imageArrayBuffer], { type: "image/png" });
                ffmpeg.writeFile(`input.png`, new Uint8Array(await imageBlob.arrayBuffer()));

                // // Convert base64 audio data to a Blob
                const audioArrayBuffer = Uint8Array.from(atob(audioData), c => c.charCodeAt(0));
                audioBlob = new Blob([audioArrayBuffer], { type: 'audio/mpeg' });
                ffmpeg.writeFile(`audio.mp3`, new Uint8Array(await audioBlob.arrayBuffer()));


                // // Convert subtitle content to a Blob (assuming it's plain text, like SRT format)
                // const subtitleBlob = new Blob([subtitleContent], { type: 'text/plain' });
                // ffmpeg.writeFile('subtitles.srt', new Uint8Array(await subtitleBlob.arrayBuffer()));
            
                // Run FFmpeg command to process the video
                // Run FFmpeg command to process the video
                await ffmpeg.exec([
                    '-loop', '1',
                    '-i', 'input.png',                // Use the input%d.png pattern to specify input files
                    '-i', 'audio.mp3',                // Replace 'audio.mp3' with the appropriate audio file path
                    '-pix_fmt', 'yuv420p',
                    '-vf', 'scale=1920:1080,setsar=1', // Scale and set SAR to 1
                    '-c:v', 'libx264',               // Video codec (you can change it if needed)
                    '-c:a', 'aac',                   // Audio codec (you can change it if needed)
                    '-strict', 'experimental',       // Use experimental AAC encoder
                    '-ar', '44100',                  // Audio sample rate (adjust as needed)
                    '-r', '30',                      // Output frame rate (adjust as needed)
                    '-tune', 'stillimage',
                    '-shortest',
                    `output${i}.mp4`
                ]);
                
                ffmpegcmd.push('-i', `output${i}.mp4`);
            }

            debugger;
            // ffmpegcmd.push(
            //     '-filter_complex', '[0:v][1:v]concat=n=2:v=1:a=0[outv];[outv]setsar=1', // Concatenate videos and set SAR
            //     '-map', '[outv]',                // Map the output video
            //     '-c:v', 'libx264',              // Video codec (you can change it if needed)
            //     '-crf', '18',                    // Constant Rate Factor (adjust as needed)
            //     '-preset', 'slow',               // Preset (adjust as needed)
            //     '-s', '1920x1080',               // Output resolution (adjust as needed)
            //     '-aspect', '16:9',               // Output aspect ratio (adjust as needed)
            //     'result.mp4'                     // Output filename
            // );
            await ffmpeg.exec([
                '-i', 'output0.mp4',
                '-i', 'output1.mp4',
                '-filter_complex', '[0:v]setsar=1[v0];[1:v]setsar=1[v1];[v0][v1]concat=n=2:v=1[outv];[0:a][1:a]amerge=inputs=2[aout]',
                '-map', '[outv]',
                '-map', '[aout]',
                'result.mp4'
            ]);

            var outputVideo = await ffmpeg.readFile('result.mp4');
            var outputURL = URL.createObjectURL(new Blob([outputVideo], { type: 'video/mp4' }));
            setTestBlobOne(outputURL);

            outputVideo = await ffmpeg.readFile('output0.mp4');
            outputURL = URL.createObjectURL(new Blob([outputVideo], { type: 'video/mp4' }));
            setTestBlobTwo(outputURL);
        });
    }

    return (
        <div>
            <input type="file" id="videoInput" accept="video/*"/>
            <input type="file" id="imageInput" multiple accept="image/*"/>
            <button onClick={onSubmitVideo} id="processButton">Process Video</button>
            {testBlobOne && (
                <video src={testBlobOne} controls width="300" height="150"></video>      
            )}
            {testBlobTwo && (
                <video src={testBlobTwo} controls width="300" height="150"></video>      
            )}
        </div>
    )
}