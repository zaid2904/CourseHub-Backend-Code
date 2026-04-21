const Course = require("../models/Course")
const User = require("../models/User")
const mailSender = require("../utils/mailSender")
const mongoose = require("mongoose")
const {
  courseEnrollmentEmail,
} = require("../mail/templates/courseEnrollmentEmail")
const CourseProgress = require("../models/CourseProgress")

exports.enrollCourse = async (req, res) => {
  const { courses } = req.body
  const userId = req.user.id

  if (!courses || courses.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: "Please Provide Course ID" })
  }

  for (const course_id of courses) {
    try {
      const course = await Course.findById(course_id)

      if (!course) {
        return res
          .status(404)
          .json({ success: false, message: "Could not find the Course" })
      }

      const uid = new mongoose.Types.ObjectId(userId)
      if (course.studentsEnroled.includes(uid)) {
        return res
          .status(409)
          .json({ success: false, message: "Student is already enrolled" })
      }
    } catch (error) {
      console.log(error)
      return res.status(500).json({ success: false, message: error.message })
    }
  }

  try {
    await enrollStudents(courses, userId, res)

    return res.status(200).json({
      success: true,
      message: "Student enrolled successfully",
    })
  } catch (error) {
    console.log(error)
    return res
      .status(500)
      .json({ success: false, message: "Could not enroll in course." })
  }
}

// enroll the student in the courses
const enrollStudents = async (courses, userId, res) => {
  if (!courses || !userId) {
    return res
      .status(400)
      .json({ success: false, message: "Please Provide Course ID and User ID" })
  }

  for (const courseId of courses) {
    try {
      // Find the course and enroll the student in it
      const enrolledCourse = await Course.findOneAndUpdate(
        { _id: courseId },
        { $addToSet: { studentsEnroled: userId } },
        { new: true }
      )

      if (!enrolledCourse) {
        return res
          .status(500)
          .json({ success: false, error: "Course not found" })
      }
      console.log("Updated course: ", enrolledCourse)

      const courseProgress = await CourseProgress.create({
        courseID: courseId,
        userId: userId,
        completedVideos: [],
      })
      // Find the student and add the course to their list of enrolled courses
      const enrolledStudent = await User.findByIdAndUpdate(
        userId,
        {
          $addToSet: {
            courses: courseId,
            courseProgress: courseProgress._id,
          },
        },
        { new: true }
      )

      console.log("Enrolled student: ", enrolledStudent)
      // Send an email notification to the enrolled student
      const emailResponse = await mailSender(
        enrolledStudent.email,
        `Successfully Enrolled into ${enrolledCourse.courseName}`,
        courseEnrollmentEmail(
          enrolledCourse.courseName,
          `${enrolledStudent.firstName} ${enrolledStudent.lastName}`
        )
      )

      console.log("Email sent successfully: ", emailResponse.response)
    } catch (error) {
      console.log(error)
      return res.status(400).json({ success: false, error: error.message })
    }
  }
}
