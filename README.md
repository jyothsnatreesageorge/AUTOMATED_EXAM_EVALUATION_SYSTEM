# Smart Automated Grading Engine

## Overview

The Smart Automated Grading Engine is a full-stack web application designed to streamline the process of evaluating handwritten or printed exam scripts. By leveraging Optical Character Recognition (OCR) and AI-based assessment, the system automates answer extraction and grading, significantly reducing manual effort while improving accuracy and consistency.

## Key Features

* **Automated Answer Evaluation**: Uses AI models to analyze and grade student responses.
* **OCR Integration**: Extracts text from uploaded images of answer sheets.
* **User-Friendly Interface**: Intuitive frontend for seamless interaction.
* **Cloud Storage Support**: Secure storage and retrieval of uploaded files.
* **Result Management**: Stores and displays evaluated results efficiently.

## Tech Stack

### Frontend

* React.js

### Backend

* Node.js
* Express.js

### Database

* MongoDB

### APIs & Services

* Gemini API (for OCR extraction and evaluation)
* AWS S3 (for file storage)
* Render
* Vercel

## System Architecture

The system follows a client-server architecture:

1. The user uploads an answer sheet via the frontend.
2. The backend processes the file and uploads it to cloud storage.
3. OCR is applied to extract textual data from the document.
4. Extracted text is passed to an AI model for evaluation.
5. Results are stored in the database and displayed to the user.

## Deployement
The system is deployed using Vercel and Render.
The deployed link is given below
smartautomatedgradingengine.vercel.app

## Advantages

* Reduces manual grading time
* Minimizes human error
* Scalable and efficient
* Enhances evaluation consistency

## Limitations

* OCR accuracy may vary depending on handwriting quality
* Requires stable internet connection for API services

## Future Enhancements

* Improved handwriting recognition
* Support for multiple languages
* Advanced analytics and reporting dashboard
* Integration with Learning Management Systems (LMS)
